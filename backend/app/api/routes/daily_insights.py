"""
API routes for Daily Security Insights.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.daily_security_insight import InsightGenerateRequest, InsightListOut, InsightOut
from app.services.daily_security_insight import (
    generate_daily_insight,
    get_insight_history,
)

router = APIRouter(prefix="/insights", tags=["daily-security-insights"])


@router.post("", response_model=InsightOut, status_code=status.HTTP_200_OK)
async def generate_insight(
    payload: InsightGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate (or return cached) the Daily Security Insight report.

    - Scoped to the authenticated user's accessible projects.
    - Pass `project_id` to focus on one project, or omit for a cross-project analysis.
    - Pass `force_regenerate=true` to bypass the daily cache.
    """
    try:
        record = await generate_daily_insight(
            db=db,
            user_id=current_user.id,
            project_id=payload.project_id,
            force_regenerate=payload.force_regenerate,
            model_override=payload.model,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Insight generation failed: {exc}",
        )

    return InsightOut.model_validate(record)


@router.get("", response_model=InsightListOut)
def list_insights(
    project_id: Optional[UUID] = Query(None, description="Filter by project"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the user's insight history, newest first."""
    items, total = get_insight_history(
        db=db,
        user_id=current_user.id,
        project_id=project_id,
        limit=limit,
        offset=offset,
    )
    return InsightListOut(
        items=[InsightOut.model_validate(r) for r in items],
        total=total,
    )


@router.get("/today", response_model=InsightOut | None)
def get_today_insight(
    project_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return today's cached insight without triggering generation (returns null if none)."""
    from datetime import datetime, UTC
    from app.models.daily_security_insight import DailySecurityInsight

    today = datetime.now(UTC).date()
    q = db.query(DailySecurityInsight).filter(
        DailySecurityInsight.user_id == current_user.id,
        DailySecurityInsight.date == today,
    )
    if project_id:
        q = q.filter(DailySecurityInsight.project_id == project_id)
    else:
        q = q.filter(DailySecurityInsight.project_id.is_(None))

    record = q.first()
    if not record:
        return None
    return InsightOut.model_validate(record)
