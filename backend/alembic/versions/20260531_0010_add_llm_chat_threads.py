"""add llm_chat_threads table

revision = "20260531_0010_llm_threads"
Revises: 20260521_0001_add_scan_summary
Create Date: 2026-05-31 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260531_0010_llm_threads"
down_revision = "20260521_0001_add_scan_summary"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_chat_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("target_payload", sa.Text(), nullable=True),
        sa.Column("messages", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_llm_chat_threads_project_id", "llm_chat_threads", ["project_id"], unique=False)
    op.create_index("ix_llm_chat_threads_user_id", "llm_chat_threads", ["user_id"], unique=False)
    op.create_index("ix_llm_chat_threads_last_message_at", "llm_chat_threads", ["last_message_at"], unique=False)
    op.create_index("ix_llm_threads_project_user_last", "llm_chat_threads", ["project_id", "user_id", "last_message_at"], unique=False)
    op.create_index("ix_llm_threads_user_updated", "llm_chat_threads", ["user_id", "updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_llm_threads_user_updated", table_name="llm_chat_threads")
    op.drop_index("ix_llm_threads_project_user_last", table_name="llm_chat_threads")
    op.drop_index("ix_llm_chat_threads_last_message_at", table_name="llm_chat_threads")
    op.drop_index("ix_llm_chat_threads_user_id", table_name="llm_chat_threads")
    op.drop_index("ix_llm_chat_threads_project_id", table_name="llm_chat_threads")
    op.drop_table("llm_chat_threads")