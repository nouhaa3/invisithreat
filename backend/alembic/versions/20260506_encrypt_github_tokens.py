"""Encrypt GitHub repository access tokens

Revision ID: 20260506_encrypt_github_tokens
Revises: 20260416_0004_add_project_performance_indexes
Create Date: 2026-05-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "20260506_encrypt_github_tokens"
down_revision = "20260416_0004_add_project_performance_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add encrypted token column and migrate data."""
    op.add_column(
        "github_repositories",
        sa.Column("access_token_encrypted", sa.String(2000), nullable=True)
    )
    # Data migration happens in post-upgrade script
    # For now, keep old column for backward compatibility during transition


def downgrade() -> None:
    """Remove encrypted token column."""
    op.drop_column("github_repositories", "access_token_encrypted")
