from __future__ import annotations

import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Iterable

import requests


logger = logging.getLogger(__name__)

OSV_API_URL = (os.getenv("OSV_API_URL") or "https://api.osv.dev/v1/querybatch").strip()
OSV_TIMEOUT_SECONDS = int((os.getenv("OSV_TIMEOUT_SECONDS") or "15").strip())

_SECRET_ECOSYSTEMS = {
    "npm": "npm",
    "pypi": "PyPI",
}


def _chunk(items: list[dict], size: int) -> Iterable[list[dict]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _map_ecosystem(value: str) -> str:
    key = (value or "").strip().lower()
    return _SECRET_ECOSYSTEMS.get(key, value)


def _osv_severity(vuln: dict) -> str:
    for sev in vuln.get("severity", []) or []:
        if sev.get("type") == "CVSS_V3":
            score = float(sev.get("score", 0) or 0)
            if score >= 9.0:
                return "critical"
            if score >= 7.0:
                return "high"
            if score >= 4.0:
                return "medium"
            if score > 0:
                return "low"
    return "medium"


def _extract_fix(vuln: dict) -> str:
    for affected in vuln.get("affected", []) or []:
        ranges = affected.get("ranges", []) or []
        for item in ranges:
            for event in item.get("events", []) or []:
                fixed = event.get("fixed")
                if fixed:
                    return f"Upgrade to {fixed} or later."
    return "Upgrade to a non-vulnerable version."


def _normalize_package(name: str) -> str:
    return (name or "").strip()


def _parse_package_lock(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    packages: list[dict] = []

    if isinstance(data.get("packages"), dict):
        for pkg_path, info in data["packages"].items():
            if pkg_path == "":
                continue
            name = info.get("name") or pkg_path.split("node_modules/")[-1]
            version = info.get("version")
            if name and version:
                packages.append({
                    "ecosystem": "npm",
                    "name": _normalize_package(name),
                    "version": str(version),
                    "file": str(path),
                })
        return packages

    def walk(deps: dict):
        for pkg_name, meta in deps.items():
            version = meta.get("version") if isinstance(meta, dict) else None
            if pkg_name and version:
                packages.append({
                    "ecosystem": "npm",
                    "name": _normalize_package(pkg_name),
                    "version": str(version),
                    "file": str(path),
                })
            if isinstance(meta, dict):
                walk(meta.get("dependencies", {}) or {})

    walk(data.get("dependencies", {}) or {})
    return packages


def _parse_requirements_txt(path: Path) -> list[dict]:
    packages: list[dict] = []
    pattern = re.compile(r"^([A-Za-z0-9_.-]+)\s*==\s*([^\s;]+)")
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = pattern.match(stripped)
        if not match:
            continue
        name, version = match.groups()
        packages.append({
            "ecosystem": "pypi",
            "name": _normalize_package(name),
            "version": version,
            "file": str(path),
        })
    return packages


def _parse_pipfile_lock(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    packages: list[dict] = []
    for section in ("default", "develop"):
        deps = data.get(section, {}) or {}
        for name, meta in deps.items():
            if not isinstance(meta, dict):
                continue
            version = str(meta.get("version") or "").strip()
            if version.startswith("=="):
                version = version[2:]
            if name and version:
                packages.append({
                    "ecosystem": "pypi",
                    "name": _normalize_package(name),
                    "version": version,
                    "file": str(path),
                })
    return packages


def _parse_poetry_lock(path: Path) -> list[dict]:
    packages: list[dict] = []
    current_name = None
    current_version = None

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if stripped == "[[package]]":
            if current_name and current_version:
                packages.append({
                    "ecosystem": "pypi",
                    "name": _normalize_package(current_name),
                    "version": current_version,
                    "file": str(path),
                })
            current_name = None
            current_version = None
            continue
        if stripped.startswith("name ="):
            current_name = stripped.split("=", 1)[1].strip().strip("\"")
        elif stripped.startswith("version ="):
            current_version = stripped.split("=", 1)[1].strip().strip("\"")

    if current_name and current_version:
        packages.append({
            "ecosystem": "pypi",
            "name": _normalize_package(current_name),
            "version": current_version,
            "file": str(path),
        })
    return packages


def _parse_yarn_lock(path: Path) -> list[dict]:
    packages: list[dict] = []
    current_names: list[str] = []

    def parse_name(value: str) -> str:
        raw = value.strip().strip("\"")
        if raw.startswith("@"):
            parts = raw.split("@")
            if len(parts) >= 3:
                return f"@{parts[1]}"
            return raw
        return raw.split("@")[0]

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip():
            continue
        if not line.startswith(" "):
            key = line.rstrip(":").strip()
            specs = [s.strip() for s in key.split(",")]
            current_names = [parse_name(spec) for spec in specs if spec]
            continue
        if line.strip().startswith("version "):
            version = line.strip().split(" ", 1)[1].strip().strip("\"")
            for name in current_names:
                if name and version:
                    packages.append({
                        "ecosystem": "npm",
                        "name": _normalize_package(name),
                        "version": version,
                        "file": str(path),
                    })
    return packages


def _collect_packages(base_path: Path) -> tuple[list[dict], list[str]]:
    packages: list[dict] = []
    lockfiles: list[str] = []

    for path in base_path.rglob("*"):
        if not path.is_file():
            continue
        name = path.name
        try:
            if name in {"package-lock.json", "npm-shrinkwrap.json"}:
                lockfiles.append(str(path))
                packages.extend(_parse_package_lock(path))
            elif name == "yarn.lock":
                lockfiles.append(str(path))
                packages.extend(_parse_yarn_lock(path))
            elif name == "requirements.txt":
                lockfiles.append(str(path))
                packages.extend(_parse_requirements_txt(path))
            elif name == "Pipfile.lock":
                lockfiles.append(str(path))
                packages.extend(_parse_pipfile_lock(path))
            elif name == "poetry.lock":
                lockfiles.append(str(path))
                packages.extend(_parse_poetry_lock(path))
        except (OSError, json.JSONDecodeError):
            logger.exception("Failed to parse dependency file %s", path)

    unique = {}
    for pkg in packages:
        key = (pkg["ecosystem"], pkg["name"], pkg["version"], pkg["file"])
        unique[key] = pkg
    return list(unique.values()), lockfiles


def _query_osv(packages: list[dict]) -> list[tuple[dict, dict]]:
    results: list[tuple[dict, dict]] = []
    if not packages:
        return results

    for chunk in _chunk(packages, 100):
        payload = {
            "queries": [
                {
                    "package": {
                        "name": pkg["name"],
                        "ecosystem": _map_ecosystem(pkg["ecosystem"]),
                    },
                    "version": pkg["version"],
                }
                for pkg in chunk
            ]
        }
        response = requests.post(OSV_API_URL, json=payload, timeout=OSV_TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        batch_results = data.get("results", []) if isinstance(data, dict) else []
        for pkg, result in zip(chunk, batch_results):
            results.append((pkg, result or {}))
    return results


def scan_dependencies(base_path: Path) -> tuple[list[dict], dict]:
    packages, lockfiles = _collect_packages(base_path)
    if not packages:
        return [], {
            "total_findings": 0,
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
            "scanned_files": len(lockfiles),
            "tool": "osv",
            "version": "api",
        }

    findings: list[dict] = []
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}

    for pkg, result in _query_osv(packages):
        for vuln in result.get("vulns", []) or []:
            severity = _osv_severity(vuln)
            counts[severity] = counts.get(severity, 0) + 1
            findings.append({
                "id": str(uuid.uuid4()),
                "rule_id": vuln.get("id") or "OSV",
                "title": vuln.get("summary") or f"{pkg['name']} {pkg['version']} vulnerability",
                "severity": severity,
                "category": "dependency",
                "description": (vuln.get("details") or "Dependency vulnerability detected.")[:2000],
                "recommendation": _extract_fix(vuln),
                "file": pkg.get("file") or "",
                "line": 0,
                "code": f"{pkg['name']}@{pkg['version']}",
                "source_tool": "osv",
            })

    return findings, {
        "total_findings": len(findings),
        "critical": counts["critical"],
        "high": counts["high"],
        "medium": counts["medium"],
        "low": counts["low"],
        "info": counts["info"],
        "scanned_files": len(lockfiles),
        "tool": "osv",
        "version": "api",
    }