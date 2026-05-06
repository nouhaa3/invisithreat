"""Add scan job tracking fields

Revision ID: 20260506_0008_scan_job_tracking
Revises: 20260506_0007_session_and_github_token_hardening
Create Date: 2026-05-06 14:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260506_0008_scan_job_tracking"
down_revision = "20260506_0007_session_and_github_token_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("job_id", sa.String(), nullable=True))
    op.add_column("scans", sa.Column("job_state", sa.String(), nullable=True))
    op.add_column("scans", sa.Column("job_attempts", sa.String(), nullable=True, server_default="0"))
    op.add_column("scans", sa.Column("job_updated_at", sa.DateTime(), nullable=True))
    op.create_index("ix_scans_job_id", "scans", ["job_id"], unique=False)
    op.create_index("ix_scans_job_state", "scans", ["job_state"], unique=False)
    op.create_check_constraint(
        "ck_scans_job_state",
        "scans",
        "job_state IS NULL OR job_state IN ('PENDING','QUEUED','RUNNING','RETRYING','SUCCESS','FAILED')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_scans_job_state", "scans", type_="check")
    op.drop_index("ix_scans_job_state", table_name="scans")
    op.drop_index("ix_scans_job_id", table_name="scans")
    op.drop_column("scans", "job_updated_at")
    op.drop_column("scans", "job_attempts")
    op.drop_column("scans", "job_state")
    op.drop_column("scans", "job_id")
