"""
OWASP ZAP health service.
In Docker mode, the backend talks to the dedicated ZAP container.
"""

import logging
import os

import requests

logger = logging.getLogger(__name__)


def _resolve_zap_url() -> str:
    raw = (os.getenv("ZAP_URL") or "").strip()
    if raw:
        return raw.rstrip("/")
    host = (os.getenv("ZAP_HOST") or "localhost").strip() or "localhost"
    port = (os.getenv("ZAP_PORT") or "8090").strip() or "8090"
    return f"http://{host}:{port}"


ZAP_URL = _resolve_zap_url()
ZAP_HEALTH_ENDPOINT = f"{ZAP_URL}/JSON/core/view/version/"
ZAP_TIMEOUT = 5


def is_zap_running() -> bool:
    try:
        response = requests.get(ZAP_HEALTH_ENDPOINT, timeout=ZAP_TIMEOUT)
        return response.status_code == 200
    except requests.RequestException:
        return False


def ensure_zap_running() -> bool:
    if is_zap_running():
        return True
    logger.error("OWASP ZAP is not reachable at %s", ZAP_URL)
    return False


def get_zap_status() -> dict:
    return {
        "running": is_zap_running(),
        "url": ZAP_URL,
    }