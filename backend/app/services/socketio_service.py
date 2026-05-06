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

from app.core.config import settings
from app.core.auth_cookies import ACCESS_COOKIE
from app.core.jwt import decode_token
from app.db.session import SessionLocal
from app.models.user import User

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
            logger.info(f'[OK] Admin {user_id} ({email}) connected (SID: {sid}) - Total admins: {len(cls.admin_connections)}')
        else:
            logger.info(f'[OK] User {user_id} ({email}) connected (SID: {sid})')
        
        if old_sid and old_sid != sid:
            logger.info(f'[WARN] User {user_id} had old SID {old_sid}, updated to {sid}')
    
    @classmethod
    def unregister_user(cls, user_id: str):
        """Unregister a disconnected user"""
        was_admin = user_id in cls.admin_connections
        
        if user_id in cls.connected_users:
            email = cls.connected_users[user_id].get('email')
            del cls.connected_users[user_id]
            if was_admin:
                del cls.admin_connections[user_id]
                logger.info(f'[ERROR] Admin {user_id} ({email}) disconnected - Remaining admins: {len(cls.admin_connections)}')
            else:
                logger.info(f'[ERROR] User {user_id} ({email}) disconnected')
        else:
            logger.warning(f'[ERROR] Attempting to unregister unknown user {user_id}')
    
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
        logger.info(f'[NOTIFY] NEW USER CREATED: {user_nom} (ID: {user_id}) - Broadcasting to {admin_count} admin(s)')
        logger.info(f'   Admin IDs: {list(cls.admin_connections.keys())}')
        
        if admin_count == 0:
            logger.warning('   [WARN] [NOTIFY] No admins connected!')
            return
        
        # Send to all connected admins
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info(f'   [OK] [NOTIFY] Emitted to admin {admin_id} (SID: {sid})')
            except Exception as e:
                logger.error(f'   [ERROR] [NOTIFY] Error sending to admin {admin_id}: {e}')
    
    @classmethod
    async def notify_user_deleted(cls, user_id: str):
        """Broadcast when a user is deleted"""
        event_data = {
            'type': 'user_deleted',
            'user_id': str(user_id),
        }
        
        admin_count = len(cls.admin_connections)
        logger.info(f'[NOTIFY] USER DELETED: {user_id} - Broadcasting to {admin_count} admin(s)')
        
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info(f'   [OK] Sent to admin {admin_id}')
            except Exception as e:
                logger.error(f'   [ERROR] Error sending to admin {admin_id}: {e}')
    
    @classmethod
    async def notify_user_status_changed(cls, user_id: str, is_active: bool):
        """Notify when user is activated/deactivated"""
        event_data = {
            'type': 'user_status_changed',
            'user_id': str(user_id),
            'is_active': is_active,
        }
        
        action = 'ACTIVATED' if is_active else 'DEACTIVATED'
        admin_count = len(cls.admin_connections)
        logger.info(f'[NOTIFY] USER {action}: {user_id} - Broadcasting to {admin_count} admin(s)')
        
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info(f'   [OK] Sent to admin {admin_id}')
            except Exception as e:
                logger.error(f'   [ERROR] Error sending to admin {admin_id}: {e}')

    @classmethod
    async def notify_user_notification_created(cls, user_id: str, notification_data: dict):
        """Emit a persisted notification event to the targeted user if connected."""
        user_key = str(user_id)
        connected = cls.connected_users.get(user_key)
        if not connected:
            logger.info(f'[NOTIFY] User {user_key} not connected - persisted notification only')
            return

        sid = connected.get('sid')
        if not sid:
            logger.warning(f'[WARN] Connected user {user_key} has no SID')
            return

        try:
            await sio.emit('notification', {
                'type': 'notification_created',
                'notification': notification_data,
            }, room=sid)
            logger.info(f'[NOTIFY] Real-time notification delivered to user {user_key}')
        except Exception as e:
            logger.error(f'[ERROR] Failed to emit notification to user {user_key}: {e}')

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
        except Exception as e:
            logger.error(f'[ERROR] Failed to schedule notification emission: {e}')

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    """Authenticate websocket connection with HttpOnly access cookie JWT."""
    raw_cookie = (environ.get("HTTP_COOKIE") or "").strip()
    if not raw_cookie:
        logger.warning("[WS] Rejecting sid %s: missing auth cookie", sid)
        return False

    cookie = SimpleCookie()
    cookie.load(raw_cookie)
    morsel = cookie.get(ACCESS_COOKIE)
    if morsel is None:
        logger.warning("[WS] Rejecting sid %s: access cookie not found", sid)
        return False

    try:
        payload = decode_token(morsel.value)
    except Exception:
        logger.warning("[WS] Rejecting sid %s: invalid access token", sid)
        return False

    if payload.get("type") != "access" or not payload.get("sub"):
        logger.warning("[WS] Rejecting sid %s: invalid token payload", sid)
        return False
    try:
        user_uuid = uuid.UUID(str(payload["sub"]))
    except (TypeError, ValueError):
        logger.warning("[WS] Rejecting sid %s: malformed user id in token", sid)
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
            logger.warning("[WS] Rejecting sid %s: user not found or inactive", sid)
            return False

        role_name = user.role.name if user.role else None
        SocketIOManager.register_user(str(user.id), sid, user.email, role_name)
        await sio.emit(
            "connected",
            {"status": "success", "message": "Authenticated websocket connection"},
            room=sid,
        )
        logger.info("[WS] Authenticated connection %s for user %s", sid, user.id)
        return True
    finally:
        db.close()

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    found = False
    for user_id, data in list(SocketIOManager.connected_users.items()):
        if data['sid'] == sid:
            logger.info(f'[WS] Client {sid} (user: {user_id}) disconnecting')
            SocketIOManager.unregister_user(user_id)
            found = True
            break
    
    if not found:
        logger.warning(f'[WARN] Disconnection event for unknown SID: {sid}')

