"""Session tracking + GitHub token hardening

Revision ID: 20260506_0007_session_and_github_token_hardening
Revises: 20260506_encrypt_github_tokens
Create Date: 2026-05-06 13:15:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

from app.core.encryption import encrypt_token


revision = "20260506_0007_session_and_github_token_hardening"
down_revision = "20260506_encrypt_github_tokens"
branch_labels = None
depends_on = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "auth_tokens"):
        op.create_table(
            "auth_tokens",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("token_jti", sa.String(length=64), nullable=False),
            sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
            sa.Column("session_type", sa.String(length=32), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"], unique=False)
        op.create_index("ix_auth_tokens_token_jti", "auth_tokens", ["token_jti"], unique=True)

    if _table_exists(inspector, "github_repositories") and _column_exists(inspector, "github_repositories", "access_token"):
        rows = bind.execute(
            text(
                """
                SELECT id, access_token
                FROM github_repositories
                WHERE access_token IS NOT NULL AND access_token <> ''
                """
            )
        ).fetchall()

        for row in rows:
            encrypted = encrypt_token(row.access_token)
            bind.execute(
                text(
                    """
                    UPDATE github_repositories
                    SET access_token_encrypted = :encrypted
                    WHERE id = :repo_id
                      AND (access_token_encrypted IS NULL OR access_token_encrypted = '')
                    """
                ),
                {"encrypted": encrypted, "repo_id": row.id},
            )

        op.drop_column("github_repositories", "access_token")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _table_exists(inspector, "github_repositories") and not _column_exists(inspector, "github_repositories", "access_token"):
        op.add_column("github_repositories", sa.Column("access_token", sa.String(length=500), nullable=True))

    if _table_exists(inspector, "auth_tokens"):
        op.drop_index("ix_auth_tokens_token_jti", table_name="auth_tokens")
        op.drop_index("ix_auth_tokens_user_id", table_name="auth_tokens")
        op.drop_table("auth_tokens")
