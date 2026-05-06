"""Add scan expires_at for retention.

Revision ID: 20260506_0005_add_scan_expires_at
Revises: 20260506_encrypt_github_tokens
"""
from alembic import op
import sqlalchemy as sa

revision = "20260506_0005_add_scan_expires_at"
down_revision = "20260506_encrypt_github_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("expires_at", sa.DateTime(), nullable=True))
    op.execute("UPDATE scans SET expires_at = (COALESCE(completed_at, started_at, NOW()) + interval '90 days')")
    op.alter_column("scans", "expires_at", nullable=False)


def downgrade() -> None:
    op.drop_column("scans", "expires_at")
