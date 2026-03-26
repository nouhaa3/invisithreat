import json
from datetime import datetime, UTC

from sqlalchemy.orm import Session

from app.models.risk_score import RiskScore
from app.models.scan import Scan, ScanStatus


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def parse_findings(results_json: str) -> list[dict]:
    if not results_json or results_json.startswith("__pending_token:"):
        return []
    try:
        data = json.loads(results_json)
    except (ValueError, TypeError, json.JSONDecodeError):
        return []
    findings = data.get("findings", [])
    return findings if isinstance(findings, list) else []


def calculate_risk(findings: list[dict]) -> dict:
    total = len(findings)
    critical = high = medium = low = info = 0

    for finding in findings:
        sev = str(finding.get("severity") or "info").lower()
        if sev == "critical":
            critical += 1
        elif sev == "high":
            high += 1
        elif sev == "medium":
            medium += 1
        elif sev == "low":
            low += 1
        else:
            info += 1

    if total == 0:
        return {
            "score": 0.0,
            "exploitability": 0.0,
            "business_impact": 0.0,
            "counts": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
        }

    severity_pressure = _clamp((critical * 2.5) + (high * 1.5) + (medium * 0.8) + (low * 0.3) + (info * 0.1), 0.0, 10.0)
    severe_ratio = (critical + high) / total
    exploitability = _clamp((severe_ratio * 7.0) + (min(total, 20) / 20.0) * 3.0, 0.0, 10.0)
    business_impact = _clamp((critical * 2.0) + (high * 1.0) + (medium * 0.5), 0.0, 10.0)
    score = _clamp((severity_pressure * 0.60) + (exploitability * 0.25) + (business_impact * 0.15), 0.0, 10.0)

    return {
        "score": round(score, 2),
        "exploitability": round(exploitability, 2),
        "business_impact": round(business_impact, 2),
        "counts": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "info": info,
        },
    }


def upsert_scan_risk_score(db: Session, scan: Scan) -> RiskScore | None:
    if scan.status != ScanStatus.completed:
        return None

    metrics = calculate_risk(parse_findings(scan.results_json or ""))
    risk = db.query(RiskScore).filter(RiskScore.scan_id == scan.id).first()
    if not risk:
        risk = RiskScore(scan_id=scan.id)
        db.add(risk)

    risk.score = metrics["score"]
    risk.exploitability = metrics["exploitability"]
    risk.business_impact = metrics["business_impact"]
    risk.calculated_at = datetime.now(UTC)
    db.commit()
    db.refresh(risk)
    return risk


def get_or_create_scan_risk_score(db: Session, scan: Scan) -> RiskScore | None:
    if scan.status != ScanStatus.completed:
        return None
    existing = db.query(RiskScore).filter(RiskScore.scan_id == scan.id).first()
    if existing:
        return existing
    return upsert_scan_risk_score(db, scan)
