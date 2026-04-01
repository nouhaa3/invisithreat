"""Initial schema for core models, including vulnerabilities and recommendations."""

# pylint: disable=invalid-name,no-member,import-error,wrong-import-position

import sys
from pathlib import Path
from typing import Any

# Ensure project package is importable when Alembic loads this module directly.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from alembic import op
from app.db.base import Base, import_models

alembic_op: Any = op

# revision identifiers, used by Alembic.
revision = "20260331_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create all tables for the initial schema."""

    import_models()
    bind = alembic_op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Drop all tables from the initial schema."""

    import_models()
    bind = alembic_op.get_bind()
    Base.metadata.drop_all(bind=bind)
