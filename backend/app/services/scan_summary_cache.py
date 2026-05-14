import json
import os
import time
from collections import OrderedDict
from threading import Lock

from app.models.scan import Scan, ScanStatus

_DEFAULT_TTL_SECONDS = 300
_DEFAULT_MAX_ENTRIES = 1000


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


_CACHE_TTL_SECONDS = _env_int("SCAN_SUMMARY_CACHE_TTL_SECONDS", _DEFAULT_TTL_SECONDS)
_CACHE_MAX_ENTRIES = _env_int("SCAN_SUMMARY_CACHE_MAX_ENTRIES", _DEFAULT_MAX_ENTRIES)

_CACHE: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
_CACHE_LOCK = Lock()


def _empty_summary() -> dict:
    return {
        "total_findings": 0,
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0,
        "scanned_files": None,
        "tool": None,
        "version": None,
    }


def _prune_cache(now: float) -> None:
    expired_keys = []
    for key, (timestamp, _) in _CACHE.items():
        if now - timestamp > _CACHE_TTL_SECONDS:
            expired_keys.append(key)
        else:
            break
    for key in expired_keys:
        _CACHE.pop(key, None)

    while len(_CACHE) > _CACHE_MAX_ENTRIES:
        _CACHE.popitem(last=False)


def _compute_summary(results_json: str | None) -> dict:
    if not results_json or results_json.startswith("__pending_token:"):
        return _empty_summary()

    try:
        payload = json.loads(results_json)
    except (ValueError, TypeError, json.JSONDecodeError):
        return _empty_summary()

    summary = payload.get("summary") if isinstance(payload, dict) else None
    findings = payload.get("findings", []) if isinstance(payload, dict) else []
    findings = findings if isinstance(findings, list) else []

    if isinstance(summary, dict):
        total = summary.get("total_findings", summary.get("total", len(findings)))
        critical = summary.get("critical")
        high = summary.get("high")
        medium = summary.get("medium")
        low = summary.get("low")
        info = summary.get("info")

        if critical is None or high is None or medium is None or low is None or info is None:
            counts = _count_findings(findings)
        else:
            counts = {
                "critical": int(critical or 0),
                "high": int(high or 0),
                "medium": int(medium or 0),
                "low": int(low or 0),
                "info": int(info or 0),
            }

        return {
            "total_findings": int(total or 0),
            "critical": counts["critical"],
            "high": counts["high"],
            "medium": counts["medium"],
            "low": counts["low"],
            "info": counts["info"],
            "scanned_files": summary.get("scanned_files"),
            "tool": summary.get("tool"),
            "version": summary.get("version"),
        }

    counts = _count_findings(findings)
    return {
        "total_findings": len(findings),
        "critical": counts["critical"],
        "high": counts["high"],
        "medium": counts["medium"],
        "low": counts["low"],
        "info": counts["info"],
        "scanned_files": None,
        "tool": None,
        "version": None,
    }


def _count_findings(findings: list[dict]) -> dict:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for finding in findings:
        sev = str((finding or {}).get("severity") or "info").lower()
        if sev not in counts:
            sev = "info"
        counts[sev] += 1
    return counts


def get_scan_summary(scan: Scan | None) -> dict:
    if not scan or scan.status != ScanStatus.completed:
        return _empty_summary()

    cache_key = str(scan.id)
    now = time.time()

    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
        if cached and now - cached[0] <= _CACHE_TTL_SECONDS:
            _CACHE.move_to_end(cache_key)
            return cached[1]

    summary = _compute_summary(scan.results_json)

    with _CACHE_LOCK:
        _CACHE[cache_key] = (now, summary)
        _CACHE.move_to_end(cache_key)
        _prune_cache(now)

    return summary
