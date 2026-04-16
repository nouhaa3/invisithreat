"""Add performance indexes for project and scan listing queries."""

# pylint: disable=invalid-name,no-member,import-error

from typing import Any

from alembic import op
import sqlalchemy as sa

alembic_op: Any = op

# revision identifiers, used by Alembic.
revision = "20260416_0004"
down_revision = "20260415_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add indexes that support common list and recency queries."""

    bind = alembic_op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {index["name"] for index in inspector.get_indexes("projects")}
    existing_scan_indexes = {index["name"] for index in inspector.get_indexes("scans")}

    if "ix_projects_created_at" not in existing_indexes:
        alembic_op.create_index("ix_projects_created_at", "projects", ["created_at"], unique=False)
    if "ix_projects_status" not in existing_indexes:
        alembic_op.create_index("ix_projects_status", "projects", ["status"], unique=False)
    if "ix_scans_project_started_at" not in existing_scan_indexes:
        alembic_op.create_index("ix_scans_project_started_at", "scans", ["project_id", "started_at"], unique=False)


def downgrade() -> None:
    """Remove the added performance indexes."""

    alembic_op.drop_index("ix_scans_project_started_at", table_name="scans")
    alembic_op.drop_index("ix_projects_status", table_name="projects")
    alembic_op.drop_index("ix_projects_created_at", table_name="projects")