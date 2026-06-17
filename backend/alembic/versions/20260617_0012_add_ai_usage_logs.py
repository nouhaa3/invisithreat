"""add ai_usage_logs table

Revision ID: 20260617_0012_add_ai_usage_logs
Revises: 20260604_0011_daily_insights
Create Date: 2026-06-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260617_0012_add_ai_usage_logs'
down_revision = '20260604_0011_daily_insights'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_usage_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_role', sa.String(50), nullable=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('vulnerability_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('vulnerability_type', sa.String(255), nullable=True),
        sa.Column('scan_type', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_ai_usage_logs_user_id', 'ai_usage_logs', ['user_id'])
    op.create_index('ix_ai_usage_logs_project_id', 'ai_usage_logs', ['project_id'])
    op.create_index('ix_ai_usage_logs_created_at', 'ai_usage_logs', ['created_at'])


def downgrade():
    op.drop_index('ix_ai_usage_logs_created_at', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_project_id', table_name='ai_usage_logs')
    op.drop_index('ix_ai_usage_logs_user_id', table_name='ai_usage_logs')
    op.drop_table('ai_usage_logs')
