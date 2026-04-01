"""Database base metadata and model import side-effects for Alembic autogeneration."""

from importlib import import_module

from sqlalchemy.orm import declarative_base

Base = declarative_base()

MODEL_MODULES = (
    "role",
    "user",
    "scan",
    "member",
    "api_key",
    "notification",
    "audit_log",
    "risk_score",
    "auth_token",
    "security_report",
    "security_metric",
    "github_repository",
    "scan_tool",
    "tool_execution",
    "scan_comparison",
    "vulnerability",
    "recommendation",
)


def import_models() -> None:
    """Import all models so metadata stays in sync for Alembic/autogenerate."""

    for module in MODEL_MODULES:
        import_module(f"app.models.{module}")


__all__ = ["Base", "MODEL_MODULES", "import_models"]


import_models()