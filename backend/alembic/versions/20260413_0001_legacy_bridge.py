"""Legacy bridge revision kept to satisfy existing alembic_version 20260413_0001.

This revision is intentionally a no-op. It restores migration graph continuity
for environments where the original 20260413_0001 file is missing.
"""

# pylint: disable=invalid-name

revision = "20260413_0001"
down_revision = "20260411_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No-op bridge revision."""


def downgrade() -> None:
    """No-op bridge revision."""
