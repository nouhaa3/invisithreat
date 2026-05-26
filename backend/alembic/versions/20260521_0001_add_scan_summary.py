"""add scan_summaries table

Revision ID: 20260521_0001_add_scan_summary
Revises: 35e874eb59e4
Create Date: 2026-05-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260521_0001_add_scan_summary'
down_revision = '35e874eb59e4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'scan_summaries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False, index=True),
        sa.Column('scan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scans.id'), nullable=False, index=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('priorities', sa.Text(), nullable=True),
        sa.Column('remediation_steps', sa.Text(), nullable=True),
        sa.Column('references', sa.Text(), nullable=True),
        sa.Column('raw', sa.Text(), nullable=True),
        sa.Column('elapsed_ms', sa.Integer(), nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('scan_summaries')
