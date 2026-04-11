"""Add project_type column to projects for explicit app category tracking."""

# pylint: disable=invalid-name,no-member,import-error

from typing import Any

from alembic import op
import sqlalchemy as sa

alembic_op: Any = op

# revision identifiers, used by Alembic.
revision = "20260411_0002"
down_revision = "20260402_0002"
branch_labels = None
depends_on = None


PROJECT_TYPE_VALUES = (
    "Web Application",
    "Mobile Application",
    "Desktop Application",
    "API / Backend",
    "Other",
)


def upgrade() -> None:
    """Add project_type and backfill with existing data where possible."""

    alembic_op.add_column(
        "projects",
        sa.Column("project_type", sa.String(), nullable=True, server_default="Other"),
    )

    # Backfill projects created while project type was temporarily stored in language.
    quoted_values = ", ".join(f"'{v}'" for v in PROJECT_TYPE_VALUES)
    alembic_op.execute(
        f"""
        UPDATE projects
        SET project_type = language
        WHERE project_type IS NULL
          AND language IN ({quoted_values})
        """
    )

    alembic_op.execute(
        """
        UPDATE projects
        SET project_type = 'Other'
        WHERE project_type IS NULL OR TRIM(project_type) = ''
        """
    )

    alembic_op.alter_column("projects", "project_type", server_default=None)


def downgrade() -> None:
    """Remove project_type column from projects."""

    alembic_op.drop_column("projects", "project_type")
