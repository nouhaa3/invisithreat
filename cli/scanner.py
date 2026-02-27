#!/usr/bin/env python3
"""
InvisiThreat CLI Scanner
Scans a local project and reports basic security vulnerabilities.

Usage:
    python scanner.py <path>
    python scanner.py <path> --format json
    python scanner.py <path> --severity high
"""

import os
import re
import sys
import json
import ast
import argparse
from dataclasses import dataclass, field, asdict
from typing import List, Optional
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ─── ANSI Colors ──────────────────────────────────────────────────────────────
RESET  = "\033[0m";  BOLD   = "\033[1m"
RED    = "\033[91m"; YELLOW = "\033[93m"; GREEN  = "\033[92m"
BLUE   = "\033[94m"; CYAN   = "\033[96m"; WHITE  = "\033[97m"
GRAY   = "\033[90m"; ORANGE = "\033[38;5;208m"

# ─── Data structures ──────────────────────────────────────────────────────────
@dataclass
class Finding:
    file: str
    line: int
    rule_id: str
    severity: str          # CRITICAL / HIGH / MEDIUM / LOW / INFO
    title: str
    description: str
    snippet: str = ""

@dataclass
class ScanResult:
    target: str
    scanned_files: int = 0
    findings: List[Finding] = field(default_factory=list)
    duration_ms: float = 0

# ─── Detection Rules ──────────────────────────────────────────────────────────
REGEX_RULES = [
    # Secrets & credentials
    {
        "id": "SEC-001", "severity": "CRITICAL", "title": "Hardcoded Password",
        "pattern": r'(?i)(password|passwd|pwd)\s*=\s*["\'][^"\']{4,}["\']',
        "description": "A hardcoded password was found. Move secrets to environment variables.",
    },
    {
        "id": "SEC-002", "severity": "CRITICAL", "title": "Hardcoded API Key / Secret",
        "pattern": r'(?i)(api_key|apikey|secret_key|secret|token)\s*=\s*["\'][A-Za-z0-9_\-\.]{10,}["\']',
        "description": "A hardcoded API key or secret was found. Use environment variables or a vault.",
    },
    {
        "id": "SEC-003", "severity": "HIGH", "title": "AWS Credentials",
        "pattern": r'(?i)(AWS_SECRET_ACCESS_KEY|aws_access_key_id)\s*=\s*["\'][^"\']+["\']',
        "description": "AWS credentials should never be hardcoded in source code.",
    },
    {
        "id": "SEC-004", "severity": "HIGH", "title": "Private Key in Source",
        "pattern": r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
        "description": "A private key was found in the source code.",
    },
    {
        "id": "SEC-005", "severity": "HIGH", "title": "JWT Secret Hardcoded",
        "pattern": r'(?i)(jwt_secret|jwt_key)\s*=\s*["\'][^"\']{4,}["\']',
        "description": "JWT secret should be loaded from environment, not hardcoded.",
    },
    # Dangerous functions
    {
        "id": "CODE-001", "severity": "HIGH", "title": "Use of eval()",
        "pattern": r'\beval\s*\(',
        "description": "eval() can execute arbitrary code. Avoid or validate input strictly.",
    },
    {
        "id": "CODE-002", "severity": "HIGH", "title": "Use of exec()",
        "pattern": r'\bexec\s*\(',
        "description": "exec() executes arbitrary Python code. This is a security risk.",
    },
    {
        "id": "CODE-003", "severity": "HIGH", "title": "Shell Injection Risk (os.system)",
        "pattern": r'\bos\.system\s*\(',
        "description": "os.system() is vulnerable to shell injection. Use subprocess with shell=False.",
    },
    {
        "id": "CODE-004", "severity": "MEDIUM", "title": "subprocess with shell=True",
        "pattern": r'subprocess\.(call|run|Popen).*shell\s*=\s*True',
        "description": "shell=True in subprocess can lead to shell injection attacks.",
    },
    {
        "id": "CODE-005", "severity": "MEDIUM", "title": "Pickle Deserialization",
        "pattern": r'\bpickle\.loads?\s*\(',
        "description": "Deserializing untrusted data with pickle can execute arbitrary code.",
    },
    # SQL Injection
    {
        "id": "SQL-001", "severity": "HIGH", "title": "Possible SQL Injection",
        "pattern": r'(?i)(execute|cursor\.execute)\s*\(\s*["\'].*(%s|%d|\+|\.format|f["\'])',
        "description": "String formatting in SQL queries can lead to SQL injection. Use parameterized queries.",
    },
    {
        "id": "SQL-002", "severity": "MEDIUM", "title": "Raw SQL with f-string",
        "pattern": r'(?i)(SELECT|INSERT|UPDATE|DELETE|DROP).*f["\']',
        "description": "f-strings in SQL queries are dangerous. Use ORM or parameterized queries.",
    },
    # Network & Crypto
    {
        "id": "NET-001", "severity": "MEDIUM", "title": "Insecure HTTP URL",
        "pattern": r'http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z]',
        "description": "HTTP (not HTTPS) used for external URL. Use HTTPS to encrypt traffic.",
    },
    {
        "id": "CRYPTO-001", "severity": "HIGH", "title": "Use of MD5",
        "pattern": r'(?i)(hashlib\.md5|md5\()',
        "description": "MD5 is cryptographically broken. Use SHA-256 or bcrypt for passwords.",
    },
    {
        "id": "CRYPTO-002", "severity": "HIGH", "title": "Use of SHA1",
        "pattern": r'(?i)(hashlib\.sha1|sha1\()',
        "description": "SHA1 is cryptographically weak. Use SHA-256 or stronger.",
    },
    # Config issues
    {
        "id": "CFG-001", "severity": "HIGH", "title": "Debug Mode Enabled",
        "pattern": r'(?i)\bDEBUG\s*=\s*True\b',
        "description": "DEBUG=True should never be used in production. It exposes stack traces.",
    },
    {
        "id": "CFG-002", "severity": "MEDIUM", "title": "Hardcoded IP Address",
        "pattern": r'\b(?!127\.0\.0\.1|0\.0\.0\.0|localhost)(\d{1,3}\.){3}\d{1,3}\b',
        "description": "Hardcoded IP addresses should be in configuration files.",
    },
    {
        "id": "CFG-003", "severity": "LOW", "title": "TODO Security Comment",
        "pattern": r'(?i)#.*\b(todo|fixme|hack|xxx)\b.*\b(auth|security|password|crypt|vuln)',
        "description": "Security-related TODO found. Address before production.",
    },
    # .env / dotenv
    {
        "id": "ENV-001", "severity": "CRITICAL", "title": "Secret in .env File Committed",
        "pattern": r'(?i)(SECRET|PASSWORD|KEY|TOKEN)\s*=\s*.{4,}',
        "description": "Ensure .env files are in .gitignore and never committed to version control.",
        "file_pattern": r'\.env$',
    },
    # JS/TS specific
    {
        "id": "JS-001", "severity": "HIGH", "title": "dangerouslySetInnerHTML",
        "pattern": r'dangerouslySetInnerHTML',
        "description": "Using dangerouslySetInnerHTML can expose XSS vulnerabilities.",
        "file_pattern": r'\.(jsx?|tsx?)$',
    },
    {
        "id": "JS-002", "severity": "HIGH", "title": "document.write() - XSS Risk",
        "pattern": r'document\.write\s*\(',
        "description": "document.write() is a common XSS vector. Use DOM manipulation instead.",
        "file_pattern": r'\.(jsx?|tsx?|html?)$',
    },
    {
        "id": "JS-003", "severity": "MEDIUM", "title": "localStorage with sensitive key",
        "pattern": r'localStorage\.setItem\s*\(\s*["\'].*(token|password|secret|key)["\']',
        "description": "Storing tokens in localStorage is vulnerable to XSS. Consider httpOnly cookies.",
        "file_pattern": r'\.(jsx?|tsx?)$',
    },
    {
        "id": "JS-004", "severity": "MEDIUM", "title": "console.log in production code",
        "pattern": r'\bconsole\.(log|error|warn)\s*\(',
        "description": "console.log statements should be removed before production.",
        "file_pattern": r'\.(jsx?|tsx?)$',
    },
]

# ─── File extensions to scan ──────────────────────────────────────────────────
SCANNABLE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".env", ".env.example", ".env.local",
    ".sh", ".bash", ".yaml", ".yml", ".json",
    ".html", ".htm",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "env", "dist", "build", ".next", ".cache", "coverage",
    "migrations", ".mypy_cache", ".pytest_cache",
}

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
SEVERITY_COLORS = {
    "CRITICAL": RED, "HIGH": ORANGE, "MEDIUM": YELLOW, "LOW": CYAN, "INFO": GRAY
}

# ─── Scanner ──────────────────────────────────────────────────────────────────
def should_scan_file(path: Path) -> bool:
    return path.suffix.lower() in SCANNABLE_EXTENSIONS or path.name.startswith(".env")

def scan_file(file_path: Path, target_root: Path) -> List[Finding]:
    findings = []
    rel_path = str(file_path.relative_to(target_root))

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
    except Exception:
        return findings

    for rule in REGEX_RULES:
        # Check if rule is limited to specific file patterns
        if "file_pattern" in rule:
            if not re.search(rule["file_pattern"], file_path.name):
                continue

        for i, line in enumerate(lines, start=1):
            if re.search(rule["pattern"], line):
                snippet = line.strip()[:120]
                findings.append(Finding(
                    file=rel_path,
                    line=i,
                    rule_id=rule["id"],
                    severity=rule["severity"],
                    title=rule["title"],
                    description=rule["description"],
                    snippet=snippet,
                ))

    return findings


def scan_project(target: str, min_severity: Optional[str] = None) -> ScanResult:
    target_path = Path(target).resolve()
    if not target_path.exists():
        print(f"{RED}Error: Path does not exist: {target}{RESET}")
        sys.exit(1)

    result = ScanResult(target=str(target_path))
    start_ms = datetime.now().timestamp() * 1000

    files_to_scan: List[Path] = []

    if target_path.is_file():
        files_to_scan = [target_path]
    else:
        for root, dirs, files in os.walk(target_path):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for fname in files:
                fp = Path(root) / fname
                if should_scan_file(fp):
                    files_to_scan.append(fp)

    for fp in files_to_scan:
        findings = scan_file(fp, target_path)
        result.findings.extend(findings)
        result.scanned_files += 1

    # Filter by severity
    if min_severity:
        threshold = SEVERITY_ORDER.get(min_severity.upper(), 4)
        result.findings = [f for f in result.findings if SEVERITY_ORDER.get(f.severity, 4) <= threshold]

    # Sort: severity first, then file, then line
    result.findings.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, 4), f.file, f.line))
    result.duration_ms = (datetime.now().timestamp() * 1000) - start_ms

    return result


# ─── Output formatters ────────────────────────────────────────────────────────
def severity_badge(sev: str) -> str:
    color = SEVERITY_COLORS.get(sev, WHITE)
    return f"{color}{BOLD}[{sev:<8}]{RESET}"


def print_banner():
    print(f"""
{ORANGE}{BOLD}
  ██╗███╗   ██╗██╗   ██╗██╗███████╗██╗████████╗██╗  ██╗██████╗ ███████╗ █████╗ ████████╗
  ██║████╗  ██║██║   ██║██║██╔════╝██║╚══██╔══╝██║  ██║██╔══██╗██╔════╝██╔══██╗╚══██╔══╝
  ██║██╔██╗ ██║██║   ██║██║███████╗██║   ██║   ███████║██████╔╝█████╗  ███████║   ██║
  ██║██║╚██╗██║╚██╗ ██╔╝██║╚════██║██║   ██║   ██╔══██║██╔══██╗██╔══╝  ██╔══██║   ██║
  ██║██║ ╚████║ ╚████╔╝ ██║███████║██║   ██║   ██║  ██║██║  ██║███████╗██║  ██║   ██║
  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝
{RESET}{GRAY}  CLI Security Scanner v0.1.0  —  InvisiThreat DevSecOps Platform{RESET}
""")


def print_console_report(result: ScanResult):
    print_banner()

    print(f"{BOLD}  Target  {RESET}: {CYAN}{result.target}{RESET}")
    print(f"{BOLD}  Files   {RESET}: {result.scanned_files} scanned")
    print(f"{BOLD}  Issues  {RESET}: {RED if result.findings else GREEN}{len(result.findings)}{RESET}")
    print(f"{BOLD}  Time    {RESET}: {result.duration_ms:.0f}ms\n")
    print(f"  {'─'*72}\n")

    if not result.findings:
        print(f"  {GREEN}{BOLD}✔  No issues found! Your project looks clean.{RESET}\n")
        return

    # Count by severity
    counts = {}
    for f in result.findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    # Summary row
    print(f"  {BOLD}Summary:{RESET}")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        if sev in counts:
            color = SEVERITY_COLORS[sev]
            print(f"    {color}{BOLD}{sev:<10}{RESET}  {color}{counts[sev]}{RESET}")
    print()

    # Group by file
    by_file = {}
    for f in result.findings:
        by_file.setdefault(f.file, []).append(f)

    for fname, findings in sorted(by_file.items()):
        print(f"  {BOLD}{BLUE}📄 {fname}{RESET}")
        print(f"  {'─'*70}")
        for f in findings:
            print(f"  {severity_badge(f.severity)}  {BOLD}{f.title}{RESET}  {GRAY}[{f.rule_id}]{RESET}")
            print(f"  {GRAY}  Line {f.line:>4}  │  {f.snippet}{RESET}")
            print(f"           {WHITE}{f.description}{RESET}")
            print()

    # Footer
    critical = counts.get("CRITICAL", 0)
    high = counts.get("HIGH", 0)
    if critical > 0:
        print(f"  {RED}{BOLD}⚠  {critical} CRITICAL issue(s) found — fix immediately before deployment!{RESET}\n")
    elif high > 0:
        print(f"  {ORANGE}{BOLD}⚠  {high} HIGH severity issue(s) — review before merging to main.{RESET}\n")
    else:
        print(f"  {YELLOW}{BOLD}✔  No critical issues found. Review medium/low findings.{RESET}\n")


def print_json_report(result: ScanResult):
    output = {
        "scanner": "InvisiThreat CLI v0.1.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "target": result.target,
        "stats": {
            "scanned_files": result.scanned_files,
            "total_findings": len(result.findings),
            "duration_ms": round(result.duration_ms, 2),
            "by_severity": {},
        },
        "findings": [asdict(f) for f in result.findings],
    }
    for f in result.findings:
        output["stats"]["by_severity"][f.severity] = output["stats"]["by_severity"].get(f.severity, 0) + 1

    print(json.dumps(output, indent=2))


# ─── Entry point ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        prog="invisithreat-scan",
        description="InvisiThreat CLI — local security scanner",
    )
    parser.add_argument("path", help="Directory or file to scan")
    parser.add_argument(
        "--format", choices=["console", "json"], default="console",
        help="Output format (default: console)"
    )
    parser.add_argument(
        "--severity", choices=["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"],
        default=None, help="Minimum severity level to report"
    )
    parser.add_argument(
        "--output", default=None, help="Write JSON report to file"
    )

    args = parser.parse_args()

    result = scan_project(args.path, min_severity=args.severity)

    if args.format == "json" or args.output:
        if args.output:
            data = {
                "scanner": "InvisiThreat CLI v0.1.0",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "target": result.target,
                "stats": {
                    "scanned_files": result.scanned_files,
                    "total_findings": len(result.findings),
                    "duration_ms": round(result.duration_ms, 2),
                },
                "findings": [asdict(f) for f in result.findings],
            }
            Path(args.output).write_text(json.dumps(data, indent=2))
            print(f"{GREEN}✔ Report saved to {args.output}{RESET}")
        if args.format == "json":
            print_json_report(result)
    else:
        print_console_report(result)

    # Exit code: 1 if CRITICAL or HIGH found
    counts = {f.severity for f in result.findings}
    if "CRITICAL" in counts or "HIGH" in counts:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
