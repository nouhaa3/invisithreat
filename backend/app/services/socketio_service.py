"""
Socket.IO service for real-time notifications
Manages WebSocket connections and emits events for real-time updates
"""
import logging
from datetime import datetime
from typing import Dict
import socketio
from http.cookies import SimpleCookie
import uuid
from sqlalchemy.orm import joinedload
from socket import error as SocketError

from app.core.config import settings
from app.core.auth_cookies import ACCESS_COOKIE
from app.core.jwt import decode_token
from app.db.session import SessionLocal
from app.models.user import User
from app.core.observability import request_id_var

logger = logging.getLogger(__name__)


def _socket_allowed_origins() -> list[str]:
    """Return stable, deduplicated origins accepted by Socket.IO CORS."""
    candidates = [
        (settings.FRONTEND_URL or "").strip().rstrip("/"),
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ]
    seen = set()
    origins: list[str] = []
    for origin in candidates:
        if not origin or origin in seen:
            continue
        seen.add(origin)
        origins.append(origin)
    return origins

# Create Socket.IO instance
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=_socket_allowed_origins(),
    logger=False,  # Reduce verbosity
    engineio_logger=False,
    transports=['websocket', 'polling'],  # Enable both WebSocket and polling
    ping_timeout=60,
    ping_interval=25,
)

class SocketIOManager:
    """Manages Socket.IO connections and notifications"""
    
    connected_users: Dict[str, dict] = {}
    admin_connections: Dict[str, str] = {}
    
    @classmethod
    def register_user(cls, user_id: str, sid: str, email: str = None, role: str = None):
        """Register a connected user"""
        old_sid = None
        if user_id in cls.connected_users:
            old_sid = cls.connected_users[user_id]['sid']
        
        cls.connected_users[user_id] = {
            'sid': sid,
            'email': email,
            'role': role
        }
        if role == 'Admin':
            cls.admin_connections[user_id] = sid
            logger.info('[OK] Admin %s (%s) connected (SID: %s) - Total admins: %s', user_id, email, sid, len(cls.admin_connections))  # pylint: disable=logging-not-lazy
        else:
            logger.info('[OK] User %s (%s) connected (SID: %s)', user_id, email, sid)  # pylint: disable=logging-not-lazy
        
        if old_sid and old_sid != sid:
            logger.info('[WARN] User %s had old SID %s, updated to %s', user_id, old_sid, sid)  # pylint: disable=logging-not-lazy
    
    @classmethod
    def unregister_user(cls, user_id: str):
        """Unregister a disconnected user"""
        was_admin = user_id in cls.admin_connections
        
        if user_id in cls.connected_users:
            email = cls.connected_users[user_id].get('email')
            del cls.connected_users[user_id]
            if was_admin:
                del cls.admin_connections[user_id]
                logger.info('[ERROR] Admin %s (%s) disconnected - Remaining admins: %s', user_id, email, len(cls.admin_connections))  # pylint: disable=logging-not-lazy
            else:
                logger.info('[ERROR] User %s (%s) disconnected', user_id, email)  # pylint: disable=logging-not-lazy
        else:
            logger.warning('[ERROR] Attempting to unregister unknown user %s', user_id)  # pylint: disable=logging-not-lazy
    
    @classmethod
    async def notify_user_created(cls, user_data: dict):
        """Broadcast when a new user is created"""
        user_id = str(user_data.get('id'))
        user_nom = user_data.get('nom')
        
        event_data = {
            'type': 'user_created',
            'user': {
                'id': user_id,
                'nom': user_nom,
                'email': user_data.get('email'),
            }
        }
        
        admin_count = len(cls.admin_connections)
        logger.info('[NOTIFY] NEW USER CREATED: %s (ID: %s) - Broadcasting to %s admin(s)', user_nom, user_id, admin_count)  # pylint: disable=logging-not-lazy
        logger.info('   Admin IDs: %s', list(cls.admin_connections.keys()))  # pylint: disable=logging-not-lazy
        
        if admin_count == 0:
            logger.warning('   [WARN] [NOTIFY] No admins connected!')  # pylint: disable=logging-not-lazy
            return
        
        # Send to all connected admins
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info('   [OK] [NOTIFY] Emitted to admin %s (SID: %s)', admin_id, sid)  # pylint: disable=logging-not-lazy
            except (OSError, RuntimeError) as e:  # pylint: disable=broad-except
                logger.error('   [ERROR] [NOTIFY] Error sending to admin %s: %s', admin_id, e)  # pylint: disable=logging-not-lazy
    
    @classmethod
    async def notify_user_deleted(cls, user_id: str):
        """Broadcast when a user is deleted"""
        event_data = {
            'type': 'user_deleted',
            'user_id': str(user_id),
        }
        
        admin_count = len(cls.admin_connections)
        logger.info('[NOTIFY] USER DELETED: %s - Broadcasting to %s admin(s)', user_id, admin_count)  # pylint: disable=logging-not-lazy
        
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info('   [OK] Sent to admin %s', admin_id)
            except (OSError, RuntimeError) as e:
                logger.error('   [ERROR] Error sending to admin %s: %s', admin_id, e)

    @classmethod
    async def notify_user_notification_created(cls, user_id: str, notification_data: dict):
        """Emit a persisted notification event to the targeted user if connected."""
        user_key = str(user_id)
        connected = cls.connected_users.get(user_key)
        if not connected:
            logger.info('[NOTIFY] User %s not connected - persisted notification only', user_key)  # pylint: disable=logging-not-lazy
            return

        sid = connected.get('sid')
        if not sid:
            logger.warning('[WARN] Connected user %s has no SID', user_key)  # pylint: disable=logging-not-lazy
            return

        try:
            await sio.emit('notification', {
                'type': 'notification_created',
                'notification': notification_data,
            }, room=sid)
            logger.info('[NOTIFY] Real-time notification delivered to user %s', user_key)  # pylint: disable=logging-not-lazy
        except (OSError, RuntimeError) as e:
            logger.error('[ERROR] Failed to emit notification to user %s: %s', user_key, e)  # pylint: disable=logging-not-lazy

    @classmethod
    def emit_notification_created(cls, notification_obj):
        """Schedule async emission for create_notification call sites (sync-safe)."""
        created_at = notification_obj.created_at
        if isinstance(created_at, datetime):
            created_at_value = created_at.isoformat()
        else:
            created_at_value = str(created_at)

        payload = {
            'id': str(notification_obj.id),
            'user_id': str(notification_obj.user_id),
            'type': notification_obj.type,
            'title': notification_obj.title,
            'message': notification_obj.message,
            'link': notification_obj.link,
            'is_read': bool(notification_obj.is_read),
            'created_at': created_at_value,
        }

        try:
            sio.start_background_task(
                cls.notify_user_notification_created,
                str(notification_obj.user_id),
                payload,
            )
        except (OSError, RuntimeError) as e:  # pylint: disable=broad-except
            logger.error('[ERROR] Failed to schedule notification emission: %s', e)  # pylint: disable=logging-not-lazy

    @classmethod
    def _emit_to_user(cls, user_id: str, event: str, payload: dict):
        connected = cls.connected_users.get(str(user_id))
        if not connected:
            return
        sid = connected.get("sid")
        if not sid:
            return
        sio.start_background_task(sio.emit, event, payload, room=sid)

    @classmethod
    def emit_scan_state_change(cls, scan_id: str, project_id: str, user_ids: list[str], job_id: str | None, job_state: str, scan_status: str):
        req_id = request_id_var.get()
        payload = {
            "type": "scan_state_change",
            "scan_id": scan_id,
            "project_id": project_id,
            "job_id": job_id,
            "job_state": job_state,
            "scan_status": scan_status,
            "request_id": req_id,
            "ts": datetime.utcnow().isoformat(),
        }
        for uid in user_ids:
            cls._emit_to_user(uid, "scan_state_change", payload)

    @classmethod
    def emit_scan_progress_update(cls, scan_id: str, project_id: str, user_ids: list[str], job_id: str | None, progress: dict):
        req_id = request_id_var.get()
        payload = {
            "type": "scan_progress_update",
            "scan_id": scan_id,
            "project_id": project_id,
            "job_id": job_id,
            "progress": progress,
            "request_id": req_id,
            "ts": datetime.utcnow().isoformat(),
        }
        for uid in user_ids:
            cls._emit_to_user(uid, "scan_progress_update", payload)

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    """Authenticate websocket connection with HttpOnly access cookie JWT."""
    raw_cookie = (environ.get("HTTP_COOKIE") or "").strip()
    if not raw_cookie:
        logger.warning("[WS] Rejecting sid %s: missing auth cookie", sid)  # pylint: disable=logging-not-lazy
        return False

    cookie = SimpleCookie()
    cookie.load(raw_cookie)
    morsel = cookie.get(ACCESS_COOKIE)
    if morsel is None:
        logger.warning("[WS] Rejecting sid %s: access cookie not found", sid)  # pylint: disable=logging-not-lazy
        return False

    try:
        payload = decode_token(morsel.value)
    except (SocketError, ConnectionError, RuntimeError):
        logger.warning("[WS] Rejecting sid %s: invalid access token", sid)  # pylint: disable=logging-not-lazy
        return False

    if payload.get("type") != "access" or not payload.get("sub"):
        logger.warning("[WS] Rejecting sid %s: invalid token payload", sid)  # pylint: disable=logging-not-lazy
        return False
    try:
        user_uuid = uuid.UUID(str(payload["sub"]))
    except (TypeError, ValueError):
        logger.warning("[WS] Rejecting sid %s: malformed user id in token", sid)  # pylint: disable=logging-not-lazy
        return False

    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.id == user_uuid, User.is_active == True)  # noqa: E712
            .first()
        )
        if not user:
            logger.warning("[WS] Rejecting sid %s: user not found or inactive", sid)  # pylint: disable=logging-not-lazy
            return False

        role_name = user.role.name if user.role else None
        SocketIOManager.register_user(str(user.id), sid, user.email, role_name)
        await sio.emit(
            "connected",
            {"status": "success", "message": "Authenticated websocket connection"},
            room=sid,
        )
        logger.info("[WS] Authenticated connection %s for user %s", sid, user.id)  # pylint: disable=logging-not-lazy
        return True
    finally:
        db.close()

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    found = False
    for user_id, data in list(SocketIOManager.connected_users.items()):
        if data['sid'] == sid:
            logger.info('[WS] Client %s (user: %s) disconnecting', sid, user_id)  # pylint: disable=logging-not-lazy
            SocketIOManager.unregister_user(user_id)
            found = True
            break
    
    if not found:
        logger.warning('[WARN] Disconnection event for unknown SID: %s', sid)  # pylint: disable=logging-not-lazy

