"""add scan analysis_type

Revision ID: 20260519_0009
Revises: 35e874eb59e4
Create Date: 2026-05-19 16:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260519_0009"
down_revision = "35e874eb59e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {col["name"] for col in inspect(bind).get_columns("scans")}
    if "analysis_type" not in columns:
        op.add_column(
            "scans",
            sa.Column("analysis_type", sa.String(), nullable=True, server_default="SAST"),
        )
        op.alter_column("scans", "analysis_type", server_default=None)

    indexes = {idx["name"] for idx in inspect(bind).get_indexes("scans")}
    if "ix_scans_analysis_type" not in indexes:
        op.create_index("ix_scans_analysis_type", "scans", ["analysis_type"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    indexes = {idx["name"] for idx in inspect(bind).get_indexes("scans")}
    if "ix_scans_analysis_type" in indexes:
        op.drop_index("ix_scans_analysis_type", table_name="scans")

    columns = {col["name"] for col in inspect(bind).get_columns("scans")}
    if "analysis_type" in columns:
        op.drop_column("scans", "analysis_type")