from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.member import ProjectMember
from app.models.scan import Project
from app.models.user import User
from app.schemas.member import MemberInviteRequest
import uuid


PROJECT_ROLES = {"Owner", "Viewer", "Editor"}


def _get_project_owner(db: Session, project_id: uuid.UUID, current_user: User) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can manage members")
    return project


def list_members(db: Session, project_id: uuid.UUID, current_user: User) -> list:
    from sqlalchemy.orm import joinedload
    # Allow owner or existing member to view the list
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    is_owner = project.owner_id == current_user.id
    is_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == current_user.id
    ).first() is not None
    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Eager load users to avoid N+1 queries
    members = db.query(ProjectMember).options(joinedload(ProjectMember.user)).filter(
        ProjectMember.project_id == project_id
    ).all()
    result = []
    for m in members:
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "nom": m.user.nom,
            "email": m.user.email,
            "role_projet": m.role_projet,
            "joined_at": m.joined_at,
        })
    return result


def invite_member(db: Session, project_id: uuid.UUID, data: MemberInviteRequest, current_user: User):
    project = _get_project_owner(db, project_id, current_user)

    # Find user by email
    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        return {"status": "not_found", "email": data.email}

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You are already the owner of this project")

    # Check if already a member
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this project")

    role = data.role_projet if data.role_projet in {"Viewer", "Editor"} else "Viewer"
    member = ProjectMember(
        id=uuid.uuid4(),
        project_id=project_id,
        user_id=user.id,
        role_projet=role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return {
        "status": "added",
        "member": {
            "id": member.id,
            "user_id": user.id,
            "nom": user.nom,
            "email": user.email,
            "role_projet": member.role_projet,
            "joined_at": member.joined_at,
        },
        "project_name": project.name,
        "inviter_name": current_user.nom,
    }


def update_member_role(db: Session, project_id: uuid.UUID, user_id: uuid.UUID, role_projet: str, current_user: User):
    _get_project_owner(db, project_id, current_user)
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role_projet = role_projet if role_projet in {"Viewer", "Editor"} else "Viewer"
    db.commit()
    db.refresh(member)
    return {
        "id": member.id,
        "user_id": member.user_id,
        "nom": member.user.nom,
        "email": member.user.email,
        "role_projet": member.role_projet,
        "joined_at": member.joined_at,
    }


def remove_member(db: Session, project_id: uuid.UUID, user_id: uuid.UUID, current_user: User):
    _get_project_owner(db, project_id, current_user)
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
