"""
Health check endpoints
"""
from fastapi import APIRouter
from datetime import datetime, UTC

router = APIRouter()


@router.get("")
async def health_check():
    """
    Health check endpoint
    Returns API status and timestamp
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "service": "InvisiThreat API"
    }
