from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.services.socketio_service import SocketIOManager


def create_notification(
    db: Session,
    user_id,
    type: str,
    title: str,
    message: str = None,
    link: str = None,
) -> Notification:
    """Create and persist a notification for a user."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Emit real-time event if the recipient is currently connected.
    SocketIOManager.emit_notification_created(notif)

    return notif
