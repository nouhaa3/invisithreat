from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx

from app.core.config import settings


def _ollama_base_url() -> str:
    raw = (settings.OLLAMA_URL or "").strip()
    if not raw:
        return "http://host.docker.internal:11434"
    return raw.rstrip("/")


class LLMError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


async def _post_ollama(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_ollama_base_url()}/api/generate"
    max_retries = max(1, int(settings.OLLAMA_MAX_RETRIES or 1))
    delay = max(0.0, float(settings.OLLAMA_RETRY_DELAY_SECONDS or 0))

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException as exc:
            if attempt < max_retries:
                await asyncio.sleep(delay)
                continue
            raise LLMError("Ollama request timed out. Try again.", status_code=504) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response else 502
            if status_code >= 500 and attempt < max_retries:
                await asyncio.sleep(delay)
                continue
            raise LLMError(f"Ollama error {status_code}.") from exc
        except httpx.RequestError as exc:
            if attempt < max_retries:
                await asyncio.sleep(delay)
                continue
            raise LLMError("Could not reach Ollama. Ensure it is running.") from exc

    raise LLMError("Ollama request failed.", status_code=502)


async def _stream_ollama(payload: dict[str, Any]):
    url = f"{_ollama_base_url()}/api/generate"
    max_retries = max(1, int(settings.OLLAMA_MAX_RETRIES or 1))
    delay = max(0.0, float(settings.OLLAMA_RETRY_DELAY_SECONDS or 0))

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        chunk = str(data.get("response") or "")
                        if chunk:
                            yield chunk
                        if data.get("done") is True:
                            return
            return
        except httpx.TimeoutException as exc:
            if attempt < max_retries:
                await asyncio.sleep(delay)
                continue
            raise LLMError("Ollama request timed out. Try again.", status_code=504) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response else 502
            if status_code >= 500 and attempt < max_retries:
                await asyncio.sleep(delay)
                continue
            raise LLMError(f"Ollama error {status_code}.") from exc
        except httpx.RequestError as exc:
            if attempt < max_retries:
                await asyncio.sleep(delay)
                continue
            raise LLMError("Could not reach Ollama. Ensure it is running.") from exc

    raise LLMError("Ollama request failed.", status_code=502)


def _slim_finding(finding: dict[str, Any]) -> dict[str, Any]:
    metadata = finding.get("metadata") or {}
    return {
        "rule_id": finding.get("rule_id"),
        "title": finding.get("title") or metadata.get("title"),
        "severity": finding.get("severity"),
        "category": finding.get("category"),
        "file": finding.get("file_path") or finding.get("file"),
        "line": finding.get("line_number") or finding.get("line"),
        "recommendation": finding.get("recommendation") or metadata.get("recommendation"),
    }


def _build_prompt(summary: dict[str, Any], findings: list[dict[str, Any]], *, project_name: str, analysis_type: str) -> str:
    payload = {
        "project_name": project_name,
        "analysis_type": analysis_type,
        "summary": summary,
        "findings": [_slim_finding(item) for item in findings],
    }
    return (
        "You are a security analyst. Use ONLY the data provided.\n"
        "Return JSON with keys: summary (string), priorities (array of strings), "
        "remediation_steps (array of strings), references (array of strings).\n"
        "Keep each list to max 5 items. Use OWASP/CWE where relevant.\n\n"
        f"DATA: {json.dumps(payload, ensure_ascii=True)}"
    )


def _extract_json(text: str) -> str | None:
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start:end + 1]


def _normalize_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


async def generate_scan_summary(
    summary: dict[str, Any],
    findings: list[dict[str, Any]],
    *,
    project_name: str,
    analysis_type: str,
) -> dict[str, Any]:
    model = (settings.OLLAMA_MODEL or "mistral").strip() or "mistral"
    prompt = _build_prompt(summary, findings, project_name=project_name, analysis_type=analysis_type)
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 400,
        },
    }

    start = time.perf_counter()
    data = await _post_ollama(payload)

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    raw = str(data.get("response") or "").strip()
    parsed_json = _extract_json(raw)
    parsed = None
    if parsed_json:
        try:
            parsed = json.loads(parsed_json)
        except json.JSONDecodeError:
            parsed = None

    return {
        "model": model,
        "summary": str((parsed or {}).get("summary") or raw or "No summary generated.").strip(),
        "priorities": _normalize_list((parsed or {}).get("priorities")),
        "remediation_steps": _normalize_list((parsed or {}).get("remediation_steps")),
        "references": _normalize_list((parsed or {}).get("references")),
        "elapsed_ms": elapsed_ms,
        "raw": raw if parsed is None else None,
    }


def _build_chat_prompt(conversation: list[dict[str, Any]]) -> str:
    parts = []
    for message in conversation:
        role = str(message.get("role") or "user").strip().upper()
        if role not in {"USER", "ASSISTANT", "SYSTEM"}:
            role = "USER"
        content = str(message.get("content") or "").strip()
        parts.append(f"{role}:\n{content}")
    parts.append("ASSISTANT:\n")
    return "\n\n".join(parts)


async def generate_vulnerability_assist(
    conversation: list[dict[str, Any]],
    *,
    system_prompt: str,
) -> dict[str, Any]:
    model = (settings.OLLAMA_MODEL or "mistral").strip() or "mistral"
    prompt = _build_chat_prompt(conversation)
    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "5m",
        "options": {
            "temperature": 0.3,
            "num_predict": 1024,
        },
    }

    start = time.perf_counter()
    data = await _post_ollama(payload)

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    reply = str(data.get("response") or "").strip()

    return {
        "model": model,
        "reply": reply or "No response generated.",
        "elapsed_ms": elapsed_ms,
    }


async def stream_vulnerability_assist(
    conversation: list[dict[str, Any]],
    *,
    system_prompt: str,
):
    model = (settings.OLLAMA_MODEL or "mistral").strip() or "mistral"
    prompt = _build_chat_prompt(conversation)
    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": prompt,
        "stream": True,
        "keep_alive": "5m",
        "options": {
            "temperature": 0.3,
            "num_predict": 1024,
        },
    }

    async for chunk in _stream_ollama(payload):
        yield chunk