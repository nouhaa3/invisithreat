"""Alembic helper to apply migrations at startup."""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import settings

logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """Apply Alembic migrations up to head.

    Fails fast when migrations cannot be applied to avoid running with an
    outdated schema.
    """
    cfg_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    if not cfg_path.exists():
        logger.warning("Alembic config not found at %s; skipping migrations.", cfg_path)
        return

    alembic_cfg = Config(str(cfg_path))
    alembic_cfg.set_main_option("script_location", str(cfg_path.parent / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

    try:
        command.upgrade(alembic_cfg, "head")
    except Exception as exc:  # pragma: no cover - fail-fast startup guard
        logger.error("Failed to apply database migrations", exc_info=exc)
        raise