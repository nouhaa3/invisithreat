"""Sanitize persisted scan payloads and drop code snippets.

Revision ID: 20260506_0006_sanitize_scan_results
Revises: 20260506_0005_add_scan_expires_at
"""
import json

from alembic import op
import sqlalchemy as sa

revision = "20260506_0006_sanitize_scan_results"
down_revision = "20260506_0005_add_scan_expires_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, results_json FROM scans WHERE results_json IS NOT NULL")).fetchall()
    for row in rows:
        try:
            payload = json.loads(row.results_json)
        except Exception:
            continue
        findings = payload.get("findings", []) if isinstance(payload, dict) else []
        if not isinstance(findings, list):
            continue
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            finding.pop("code", None)
            finding.pop("snippet", None)
            finding.pop("secret", None)
        payload["findings"] = findings
        conn.execute(
            sa.text("UPDATE scans SET results_json = :results_json WHERE id = :id"),
            {"results_json": json.dumps(payload), "id": str(row.id)},
        )


def downgrade() -> None:
    # irreversible sanitization by design
    pass
