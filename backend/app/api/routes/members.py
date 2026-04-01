from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.db.session import get_db
from app.core.permissions import require_permission, P
from app.models.user import User
from app.models.scan import Project
from app.schemas.member import MemberInviteRequest, MemberRoleUpdate, MemberResponse
from app.services.member import list_members, invite_member, update_member_role, remove_member
from app.services.notification import create_notification
from app.core.email import notify_project_invitation, email_is_configured
from app.core.config import settings

router = APIRouter(prefix="/projects/{project_id}/members", tags=["Members"])


@router.get("", response_model=List[MemberResponse])
async def get_members(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_PROJECT_MEMBERS)),
):
    return list_members(db, project_id, current_user)


@router.post("/invite", status_code=201)
async def invite_project_member(
    project_id: uuid.UUID,
    data: MemberInviteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_PROJECT_MEMBERS)),
):
    if not email_is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured. Contact an administrator.")

    result = invite_member(db, project_id, data, current_user)

    if result["status"] == "not_found":
        project = db.query(Project).filter(Project.id == project_id).first()
        project_name = project.name if project else "the project"
        background_tasks.add_task(
            notify_project_invitation,
            invitee_email=data.email,
            invitee_nom=None,
            inviter_nom=current_user.nom,
            project_name=project_name,
            role=data.role_projet or "Viewer",
            registered=False,
            frontend_url=settings.FRONTEND_URL,
        )
        return {"status": "invited", "message": f"No account found for {data.email}. An invitation email has been sent."}

    background_tasks.add_task(
        notify_project_invitation,
        invitee_email=result["member"]["email"],
        invitee_nom=result["member"]["nom"],
        inviter_nom=result["inviter_name"],
        project_name=result["project_name"],
        role=result["member"]["role_projet"],
        registered=True,
        frontend_url=settings.FRONTEND_URL,
    )
    # In-app notification for the invited user
    create_notification(
        db,
        user_id=result["member"]["user_id"],
        type="project_invite",
        title=f'Added to project "{result["project_name"]}"',
        message=f'{current_user.nom} added you as {result["member"]["role_projet"]}.',
        link=f'/projects/{project_id}',
    )
    return {"status": "added", "member": result["member"]}


@router.patch("/{user_id}", response_model=MemberResponse)
async def update_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    data: MemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_PROJECT_MEMBERS)),
):
    return update_member_role(db, project_id, user_id, data.role_projet, current_user)


@router.delete("/{user_id}", status_code=204)
async def remove_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_PROJECT_MEMBERS)),
):
    remove_member(db, project_id, user_id, current_user)
