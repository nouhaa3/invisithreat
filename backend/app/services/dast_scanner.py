"""
DAST scanner service based on OWASP ZAP.
Returns a result compatible with the existing Scan.results_json format.
"""

import asyncio
import logging
import os
import time
from typing import Callable, Optional
from urllib.parse import urlparse

from app.services.owasp_zap import ensure_zap_running
from app.services.zap_client import ZapApiException, ZapClient

logger = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[dict], None]]


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


def _env_int_capped(name: str, default: int, max_value: int) -> int:
    """Read int env var while enforcing an upper bound for predictable runtimes."""
    return min(_env_int(name, default), max_value)


DEFAULT_SPIDER_TIMEOUT = _env_int_capped("DAST_SPIDER_TIMEOUT", 180, 300)
DEFAULT_ASCAN_TIMEOUT = _env_int_capped("DAST_ASCAN_TIMEOUT", 300, 600)
DEFAULT_NO_PROGRESS_TIMEOUT = _env_int_capped("DAST_NO_PROGRESS_TIMEOUT", 120, 240)
DEFAULT_PASSIVE_WAIT_SECONDS = _env_int_capped("DAST_PASSIVE_WAIT_SECONDS", 20, 60)


def _validate_target_url(target_url: str) -> None:
    parsed = urlparse(target_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Invalid target URL. Only http/https URLs are allowed.")


def _map_severity(risk: str) -> str:
    risk = (risk or "").strip().lower()
    if risk == "high":
        return "high"
    if risk == "medium":
        return "medium"
    if risk == "low":
        return "low"
    return "info"


def _emit(callback: ProgressCallback, payload: dict) -> None:
    if callback:
        callback(payload)


def _normalize_alert(alert: dict, index: int) -> dict:
    endpoint = alert.get("url") or ""
    description = alert.get("description") or alert.get("desc") or "No description provided by ZAP."
    recommendation = alert.get("solution") or f"Review and remediate: {alert.get('name', 'Unknown alert')}"
    severity = _map_severity(alert.get("risk"))

    return {
        "id": f"dast-{index}",
        "rule_id": f"DAST_{index}",
        "title": alert.get("name") or "Unknown DAST finding",
        "severity": severity,
        "category": "dast",
        "description": description,
        "recommendation": recommendation,
        "file": endpoint,
        "line": 0,
        "code": description[:200],
        "source_tool": "owasp_zap",
    }


def _build_severity_distribution(findings: list[dict]) -> dict:
    distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for finding in findings:
        sev = finding.get("severity", "info")
        if sev in distribution:
            distribution[sev] += 1
        else:
            distribution["info"] += 1
    return distribution


def _safe_fetch_alerts(client: ZapClient, base_url: str | None = None) -> list[dict]:
    try:
        if base_url:
            alerts_resp = client.core.alerts(baseurl=base_url)
        else:
            alerts_resp = client.core.alerts()
        alerts = alerts_resp.get("alerts", []) if isinstance(alerts_resp, dict) else []
        return alerts if isinstance(alerts, list) else []
    except ZapApiException:
        logger.exception("Failed to fetch alerts from ZAP after scan interruption")
        return []


async def _wait_for_passive_scan(client: ZapClient, timeout_seconds: int) -> None:
    """Wait briefly for passive scan backlog to drain before reading alerts."""
    if timeout_seconds <= 0:
        return

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            pending = client.pscan.records_to_scan()
        except ZapApiException:
            # If pscan endpoint is unavailable, do not block scan finalization.
            return

        if pending <= 0:
            return

        await asyncio.sleep(1)


def _build_result_payload(
    *,
    completed: bool,
    target_url: str,
    spider_progress: int,
    active_scan_progress: int,
    findings: list[dict],
    error: str | None,
) -> dict:
    return {
        "completed": completed,
        "target_url": target_url,
        "progress": {
            "spider_progress": max(0, min(100, spider_progress)),
            "active_scan_progress": max(0, min(100, active_scan_progress)),
        },
        "vulnerabilities": findings,
        "severity_distribution": _build_severity_distribution(findings),
        "error": error,
    }


async def run_dast_scan_async(
    target_url: str,
    progress_callback: ProgressCallback = None,
    spider_timeout: int = DEFAULT_SPIDER_TIMEOUT,
    ascan_timeout: int = DEFAULT_ASCAN_TIMEOUT,
    no_progress_timeout: int = DEFAULT_NO_PROGRESS_TIMEOUT,
    passive_wait_seconds: int = DEFAULT_PASSIVE_WAIT_SECONDS,
) -> dict:
    _validate_target_url(target_url)

    if not ensure_zap_running():
        return {
            "completed": False,
            "target_url": target_url,
            "progress": {"spider_progress": 0, "active_scan_progress": 0},
            "vulnerabilities": [],
            "severity_distribution": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "error": "OWASP ZAP is not reachable.",
        }

    spider_progress = 0
    active_progress = 0
    client = None

    try:
        client = ZapClient()

        _emit(progress_callback, {
            "stage": "initializing",
            "spider_progress": 0,
            "active_scan_progress": 0,
            "alerts_found": 0,
        })

        client.new_session(name="invisithreat_dast", overwrite=True)

        spider_resp = client.spider.scan(target_url, recurse=True)
        spider_id = spider_resp.get("scan")
        if not spider_id:
            raise RuntimeError("Failed to start spider scan.")

        spider_started_at = time.monotonic()
        spider_last_change_at = spider_started_at
        spider_last_progress = -1
        while True:
            spider_progress = client.spider.status(spider_id)
            now = time.monotonic()
            if spider_progress != spider_last_progress:
                spider_last_progress = spider_progress
                spider_last_change_at = now

            _emit(progress_callback, {
                "stage": "spider_in_progress",
                "spider_progress": spider_progress,
                "active_scan_progress": 0,
                "alerts_found": 0,
            })

            if spider_progress >= 100:
                break

            if now - spider_started_at >= spider_timeout:
                raise RuntimeError("Spider scan timed out.")

            if now - spider_last_change_at >= no_progress_timeout:
                try:
                    client.spider.stop_scan(spider_id)
                except ZapApiException:
                    pass
                raise RuntimeError("Spider scan stalled with no progress.")

            await asyncio.sleep(2)

        discovered_urls = client.spider.results(spider_id)
        if not discovered_urls:
            raise RuntimeError("Spider found 0 URLs. Target may be unreachable from ZAP.")

        _emit(progress_callback, {
            "stage": "finalizing_passive_scan",
            "spider_progress": 100,
            "active_scan_progress": 0,
            "alerts_found": 0,
        })
        await _wait_for_passive_scan(client, passive_wait_seconds)

        target_host = urlparse(target_url).hostname
        same_host_urls = [u for u in discovered_urls if urlparse(u).hostname == target_host]
        active_target = same_host_urls[0] if same_host_urls else discovered_urls[0]

        ascan_resp = client.ascan.scan(active_target, recurse=True)
        ascan_id = ascan_resp.get("scan")
        if not ascan_id:
            raise RuntimeError("Failed to start active scan.")

        ascan_started_at = time.monotonic()
        ascan_last_change_at = ascan_started_at
        ascan_last_progress = -1
        while True:
            active_progress = client.ascan.status(ascan_id)
            now = time.monotonic()
            if active_progress != ascan_last_progress:
                ascan_last_progress = active_progress
                ascan_last_change_at = now

            _emit(progress_callback, {
                "stage": "active_scan_in_progress",
                "spider_progress": 100,
                "active_scan_progress": active_progress,
                "alerts_found": 0,
            })

            if active_progress >= 100:
                break

            if now - ascan_started_at >= ascan_timeout:
                try:
                    client.ascan.stop_scan(ascan_id)
                except ZapApiException:
                    pass
                raise RuntimeError("Active scan timed out.")

            if now - ascan_last_change_at >= no_progress_timeout:
                try:
                    client.ascan.stop_scan(ascan_id)
                except ZapApiException:
                    pass
                raise RuntimeError("Active scan stalled with no progress.")

            await asyncio.sleep(3)

        _emit(progress_callback, {
            "stage": "collecting_alerts",
            "spider_progress": 100,
            "active_scan_progress": 100,
            "alerts_found": 0,
        })
        await _wait_for_passive_scan(client, passive_wait_seconds)

        alerts = _safe_fetch_alerts(client, base_url=target_url)

        findings = [_normalize_alert(alert, idx) for idx, alert in enumerate(alerts, start=1)]

        _emit(progress_callback, {
            "stage": "completed",
            "spider_progress": 100,
            "active_scan_progress": 100,
            "alerts_found": len(findings),
        })

        return _build_result_payload(
            completed=True,
            target_url=target_url,
            spider_progress=100,
            active_scan_progress=100,
            findings=findings,
            error=None,
        )

    except (ZapApiException, RuntimeError, ValueError) as exc:
        logger.exception("DAST scan failed for %s", target_url)
        message = str(exc)
        recoverable = any(token in message.lower() for token in ("timed out", "stalled"))

        if client is not None and recoverable:
            await _wait_for_passive_scan(client, passive_wait_seconds)
            alerts = _safe_fetch_alerts(client, base_url=target_url)
            findings = [_normalize_alert(alert, idx) for idx, alert in enumerate(alerts, start=1)]
            warning = f"Scan completed with warnings: {message}"
            _emit(progress_callback, {
                "stage": "completed_with_warnings",
                "spider_progress": spider_progress,
                "active_scan_progress": active_progress,
                "alerts_found": len(findings),
                "error": warning,
            })
            return _build_result_payload(
                completed=True,
                target_url=target_url,
                spider_progress=spider_progress,
                active_scan_progress=active_progress,
                findings=findings,
                error=warning,
            )

        return _build_result_payload(
            completed=False,
            target_url=target_url,
            spider_progress=spider_progress,
            active_scan_progress=active_progress,
            findings=[],
            error=message,
        )