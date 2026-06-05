"""add daily_security_insights table

Revision ID: 20260604_0011_add_daily_security_insights
Revises: 20260531_0010_add_llm_chat_threads
Create Date: 2026-06-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260604_0011_add_daily_security_insights'
down_revision = '20260531_0010_add_llm_chat_threads'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trend_status_enum') THEN
                CREATE TYPE trend_status_enum AS ENUM ('Improving', 'Stable', 'Worsening');
            END IF;
        END $$;
    """)

    op.create_table(
        'daily_security_insights',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('generated_insight', sa.Text(), nullable=False),
        sa.Column('trend_status',
                  sa.Enum('Improving', 'Stable', 'Worsening', name='trend_status_enum'),
                  nullable=False, server_default='Stable'),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('context_summary', sa.Text(), nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=False,
                  server_default=sa.text("NOW()")),
    )

    op.create_index(
        'uix_daily_insight_user_project_date',
        'daily_security_insights',
        ['user_id', 'project_id', 'date'],
        unique=True,
    )
    op.create_index('ix_daily_insight_user_date', 'daily_security_insights', ['user_id', 'date'])
    op.create_index('ix_daily_insight_project_date', 'daily_security_insights', ['project_id', 'date'])


def downgrade():
    op.drop_index('ix_daily_insight_project_date', table_name='daily_security_insights')
    op.drop_index('ix_daily_insight_user_date', table_name='daily_security_insights')
    op.drop_index('uix_daily_insight_user_project_date', table_name='daily_security_insights')
    op.drop_table('daily_security_insights')
