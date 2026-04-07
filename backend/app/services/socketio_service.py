"""
Socket.IO service for real-time notifications
Manages WebSocket connections and emits events for real-time updates
"""
import logging
from typing import Dict
import socketio

logger = logging.getLogger(__name__)

# Create Socket.IO instance
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
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
            logger.info(f'✅ Admin {user_id} ({email}) connected (SID: {sid}) - Total admins: {len(cls.admin_connections)}')
        else:
            logger.info(f'✅ User {user_id} ({email}) connected (SID: {sid})')
        
        if old_sid and old_sid != sid:
            logger.info(f'⚠️ User {user_id} had old SID {old_sid}, updated to {sid}')
    
    @classmethod
    def unregister_user(cls, user_id: str):
        """Unregister a disconnected user"""
        was_admin = user_id in cls.admin_connections
        
        if user_id in cls.connected_users:
            email = cls.connected_users[user_id].get('email')
            del cls.connected_users[user_id]
            if was_admin:
                del cls.admin_connections[user_id]
                logger.info(f'❌ Admin {user_id} ({email}) disconnected - Remaining admins: {len(cls.admin_connections)}')
            else:
                logger.info(f'❌ User {user_id} ({email}) disconnected')
        else:
            logger.warning(f'❌ Attempting to unregister unknown user {user_id}')
    
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
        logger.info(f'📢 [NOTIFY] NEW USER CREATED: {user_nom} (ID: {user_id}) - Broadcasting to {admin_count} admin(s)')
        logger.info(f'   Admin IDs: {list(cls.admin_connections.keys())}')
        
        if admin_count == 0:
            logger.warning('   ⚠️ [NOTIFY] No admins connected!')
            return
        
        # Send to all connected admins
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info(f'   ✅ [NOTIFY] Emitted to admin {admin_id} (SID: {sid})')
            except Exception as e:
                logger.error(f'   ❌ [NOTIFY] Error sending to admin {admin_id}: {e}')
    
    @classmethod
    async def notify_user_deleted(cls, user_id: str):
        """Broadcast when a user is deleted"""
        event_data = {
            'type': 'user_deleted',
            'user_id': str(user_id),
        }
        
        admin_count = len(cls.admin_connections)
        logger.info(f'📢 USER DELETED: {user_id} - Broadcasting to {admin_count} admin(s)')
        
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info(f'   ✅ Sent to admin {admin_id}')
            except Exception as e:
                logger.error(f'   ❌ Error sending to admin {admin_id}: {e}')
    
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
        logger.info(f'📢 USER {action}: {user_id} - Broadcasting to {admin_count} admin(s)')
        
        for admin_id, sid in list(cls.admin_connections.items()):
            try:
                await sio.emit('notification', event_data, room=sid)
                logger.info(f'   ✅ Sent to admin {admin_id}')
            except Exception as e:
                logger.error(f'   ❌ Error sending to admin {admin_id}: {e}')

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    logger.info(f'🔌 New WebSocket connection: {sid}')

@sio.event
async def identify(sid, data):
    """Identify the user after connection"""
    user_id = data.get('user_id')
    email = data.get('email')
    role = data.get('role')
    
    logger.info(f'🔐 [IDENTIFY] SID {sid} - user_id: {user_id}, role: {role}')
    
    if user_id:
        logger.info(f'🔐 [IDENTIFY] Registering user {user_id} as {role}')
        SocketIOManager.register_user(user_id, sid, email, role)
        await sio.emit('connected', {
            'status': 'success',
            'message': 'Identified successfully',
            'user_id': user_id,
        }, room=sid)
    else:
        logger.warning(f'⚠️ [IDENTIFY] No user_id provided by {sid}')

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    found = False
    for user_id, data in list(SocketIOManager.connected_users.items()):
        if data['sid'] == sid:
            logger.info(f'🔌 Client {sid} (user: {user_id}) disconnecting')
            SocketIOManager.unregister_user(user_id)
            found = True
            break
    
    if not found:
        logger.warning(f'⚠️ Disconnection event for unknown SID: {sid}')

