"""Legacy bridge revision kept to satisfy existing alembic_version in deployed DBs.

This revision existed in earlier environments but is not present in this codebase.
It is intentionally a no-op so newer migrations can continue safely.
"""

# pylint: disable=invalid-name

revision = "20260402_0002"
down_revision = "20260331_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No-op bridge revision."""


def downgrade() -> None:
    """No-op bridge revision."""
