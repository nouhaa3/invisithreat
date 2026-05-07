"""merge_all_heads

Ce fichier fusionne les deux branches de migration parallèles :
  - 20260506_0006_sanitize_scan_results
  - 20260506_0008_scan_job_tracking
"""

revision = "35e874eb59e4"
down_revision = ("20260506_0006_sanitize_scan_results", "20260506_0008_scan_job_tracking")
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass