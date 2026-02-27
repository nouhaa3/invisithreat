"""
Core scanning engine - walks a directory and applies rules to each file
"""
import re
import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional

from cli.rules.python_rules import PYTHON_RULES
from cli.rules.js_rules import JS_RULES
from cli.rules.general_rules import GENERAL_RULES

# Files/dirs to skip
SKIP_DIRS = {
    ".git", ".svn", "node_modules", "__pycache__", ".venv", "venv",
    "env", ".env", "dist", "build", ".next", ".nuxt", "coverage",
    ".pytest_cache", ".mypy_cache", "migrations",
}

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
    ".ttf", ".eot", ".mp4", ".mp3", ".zip", ".tar", ".gz", ".pdf",
    ".lock", ".min.js", ".min.css",
}

# Extension → rules mapping
RULES_MAP = {
    ".py":   PYTHON_RULES + GENERAL_RULES,
    ".js":   JS_RULES + GENERAL_RULES,
    ".jsx":  JS_RULES + GENERAL_RULES,
    ".ts":   JS_RULES + GENERAL_RULES,
    ".tsx":  JS_RULES + GENERAL_RULES,
    ".mjs":  JS_RULES + GENERAL_RULES,
    ".env":  GENERAL_RULES,
    ".yml":  GENERAL_RULES,
    ".yaml": GENERAL_RULES,
    ".json": GENERAL_RULES,
    ".sh":   GENERAL_RULES,
    ".bash": GENERAL_RULES,
    ".conf": GENERAL_RULES,
    ".cfg":  GENERAL_RULES,
    ".ini":  GENERAL_RULES,
    ".toml": GENERAL_RULES,
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}


@dataclass
class Finding:
    rule_id:     str
    name:        str
    severity:    str
    category:    str
    description: str
    fix:         str
    file:        str
    line:        int
    code:        str


@dataclass
class ScanResult:
    target:    str
    findings:  List[Finding] = field(default_factory=list)
    scanned:   int = 0
    skipped:   int = 0
    errors:    List[str] = field(default_factory=list)

    @property
    def counts(self):
        c = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for f in self.findings:
            c[f.severity] = c.get(f.severity, 0) + 1
        return c


def _should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
    suffix = path.suffix.lower()
    for ext in SKIP_EXTENSIONS:
        if path.name.endswith(ext):
            return True
    return False


def _scan_file(filepath: Path, rel_path: str) -> tuple[List[Finding], Optional[str]]:
    findings = []
    suffix = filepath.suffix.lower()
    rules = RULES_MAP.get(suffix, [])
    if not rules:
        return findings, None

    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return findings, str(e)

    lines = content.splitlines()
    for rule in rules:
        pattern = re.compile(rule["pattern"], re.IGNORECASE)
        for lineno, line in enumerate(lines, start=1):
            if pattern.search(line):
                findings.append(Finding(
                    rule_id=rule["id"],
                    name=rule["name"],
                    severity=rule["severity"],
                    category=rule["category"],
                    description=rule["description"],
                    fix=rule["fix"],
                    file=rel_path,
                    line=lineno,
                    code=line.strip()[:120],
                ))

    return findings, None


def scan(target: str) -> ScanResult:
    target_path = Path(target).resolve()
    result = ScanResult(target=str(target_path))

    if not target_path.exists():
        result.errors.append(f"Path does not exist: {target}")
        return result

    files = [target_path] if target_path.is_file() else [
        p for p in target_path.rglob("*") if p.is_file()
    ]

    for filepath in files:
        if _should_skip(filepath):
            result.skipped += 1
            continue

        rel = str(filepath.relative_to(target_path if target_path.is_dir() else target_path.parent))
        findings, err = _scan_file(filepath, rel)

        if err:
            result.errors.append(f"{rel}: {err}")
        else:
            result.scanned += 1
            result.findings.extend(findings)

    # Sort by severity then file + line
    result.findings.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, 9), f.file, f.line))
    return result
