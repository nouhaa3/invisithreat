#!/usr/bin/env python3
"""
InvisiThreat CLI Scanner — v0.1.0
Scans a local directory for security vulnerabilities and uploads results to the platform.

Usage:
    python scan.py <directory> --token <UPLOAD_TOKEN> [--api-url <API_URL>]

Examples:
    python scan.py . --token abc123xyz
    python scan.py /path/to/project --token abc123xyz --api-url http://localhost:8000
"""

import argparse
import ast
import hashlib
import json
import os
import re
import sys
import uuid
from pathlib import Path

try:
    import requests
except ImportError:
    print("[ERROR] Missing dependency: pip install requests")
    sys.exit(1)

# ─── Configuration ────────────────────────────────────────────────────────────

DEFAULT_API_URL = "http://localhost:8000"
VERSION = "0.1.0"

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv",
    "env", "dist", "build", ".mypy_cache", ".pytest_cache", ".tox",
    "coverage", ".coverage", "htmlcov",
}

SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
    "Gemfile.lock", "Cargo.lock", "poetry.lock", "packages.lock.json",
    "npm-shrinkwrap.json",
}

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rb",
    ".php", ".cs", ".cpp", ".c", ".h", ".yaml", ".yml",
    ".env", ".cfg", ".ini", ".conf", ".sh", ".bash",
}

# ─── Detection Rules ─────────────────────────────────────────────────────────

REGEX_RULES = [
    # Hardcoded secrets
    {
        "id": "SEC001",
        "title": "Hardcoded Password",
        "severity": "high",
        "category": "hardcoded_secret",
        "pattern": re.compile(
            r'(?i)(password|passwd|pwd)\s*=\s*["\'][^"\']{4,}["\']', re.IGNORECASE
        ),
        "description": "A hardcoded password was found. Use environment variables instead.",
    },
    {
        "id": "SEC002",
        "title": "Hardcoded API Key or Secret",
        "severity": "high",
        "category": "hardcoded_secret",
        "pattern": re.compile(
            r'(?i)(api_key|apikey|secret_key|secret|token|access_key|private_key)\s*=\s*["\'][A-Za-z0-9+/=_\-]{8,}["\']'
        ),
        "description": "A hardcoded API key or secret was found. Store secrets in environment variables or a secrets manager.",
    },
    {
        "id": "SEC003",
        "title": "Hardcoded AWS Key",
        "severity": "critical",
        "category": "hardcoded_secret",
        "pattern": re.compile(r'AKIA[0-9A-Z]{16}'),
        "description": "An AWS Access Key ID was found hardcoded in source code.",
    },
    {
        "id": "SEC004",
        "title": "Hardcoded Private Key or Certificate",
        "severity": "critical",
        "category": "hardcoded_secret",
        "pattern": re.compile(r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
        "description": "A private key or certificate was found hardcoded. Never commit private keys.",
    },
    # SQL Injection
    {
        "id": "SQL001",
        "title": "Potential SQL Injection",
        "severity": "high",
        "category": "sql_injection",
        "pattern": re.compile(
            r'(execute|query|raw)\s*\(\s*["\'].*?(SELECT|INSERT|UPDATE|DELETE|DROP).*?["\'\s]*%\s*(s|d)|'
            r'f["\'].*?(SELECT|INSERT|UPDATE|DELETE).*?\{',
            re.IGNORECASE,
        ),
        "description": "String formatting used to build a SQL query — use parameterized queries instead.",
    },
    # Debug/Dangerous flags
    {
        "id": "CFG001",
        "title": "Debug Mode Enabled",
        "severity": "medium",
        "category": "configuration",
        "pattern": re.compile(r'(?i)\bDEBUG\s*=\s*True\b'),
        "description": "DEBUG=True found. Ensure this is not deployed to production.",
    },
    {
        "id": "CFG002",
        "title": "Weak Secret Key",
        "severity": "high",
        "category": "configuration",
        "pattern": re.compile(r'(?i)SECRET_KEY\s*=\s*["\'][^"\']{1,20}["\']'),
        "description": "A short or weak SECRET_KEY was found. Use a long random key in production.",
    },
    # Dangerous functions (Python)
    {
        "id": "PY001",
        "title": "Use of eval()",
        "severity": "high",
        "category": "code_injection",
        "pattern": re.compile(r'\beval\s*\('),
        "description": "eval() can execute arbitrary code. Avoid using it with user-controlled input.",
    },
    {
        "id": "PY002",
        "title": "Use of exec()",
        "severity": "high",
        "category": "code_injection",
        "pattern": re.compile(r'\bexec\s*\('),
        "description": "exec() can execute arbitrary code. Avoid using it with user-controlled input.",
    },
    {
        "id": "PY003",
        "title": "Pickle Deserialization",
        "severity": "high",
        "category": "deserialization",
        "pattern": re.compile(r'\bpickle\.(loads?|Unpickler)\b'),
        "description": "Deserializing untrusted pickle data can lead to remote code execution.",
    },
    {
        "id": "PY004",
        "title": "Shell Injection Risk (subprocess)",
        "severity": "medium",
        "category": "command_injection",
        "pattern": re.compile(r'subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True'),
        "description": "subprocess called with shell=True. Prefer shell=False with a list of arguments.",
    },
    {
        "id": "PY005",
        "title": "Use of os.system()",
        "severity": "medium",
        "category": "command_injection",
        "pattern": re.compile(r'\bos\.system\s*\('),
        "description": "os.system() can be dangerous with user input. Use subprocess with shell=False.",
    },
    # JavaScript / Node
    {
        "id": "JS001",
        "title": "Use of innerHTML",
        "severity": "medium",
        "category": "xss",
        "pattern": re.compile(r'\.innerHTML\s*='),
        "description": "Setting innerHTML with user data can lead to XSS. Use textContent or DOMPurify.",
    },
    {
        "id": "JS002",
        "title": "Use of dangerouslySetInnerHTML",
        "severity": "medium",
        "category": "xss",
        "pattern": re.compile(r'dangerouslySetInnerHTML'),
        "description": "dangerouslySetInnerHTML bypasses React's XSS protection. Sanitize input first.",
    },
    {
        "id": "JS003",
        "title": "Direct Object Store (eval in JS)",
        "severity": "high",
        "category": "code_injection",
        "pattern": re.compile(r'\beval\s*\('),
        "description": "eval() in JavaScript executes arbitrary code.",
    },
    # Crypto
    {
        "id": "CRY001",
        "title": "Use of MD5",
        "severity": "medium",
        "category": "weak_cryptography",
        "pattern": re.compile(r'\bmd5\b', re.IGNORECASE),
        "description": "MD5 is cryptographically broken. Use SHA-256 or bcrypt for passwords.",
    },
    {
        "id": "CRY002",
        "title": "Use of SHA1",
        "severity": "low",
        "category": "weak_cryptography",
        "pattern": re.compile(r'\bsha1\b', re.IGNORECASE),
        "description": "SHA-1 is deprecated for security use. Prefer SHA-256 or stronger.",
    },
    # Network
    {
        "id": "NET001",
        "title": "HTTP URL (not HTTPS)",
        "severity": "low",
        "category": "insecure_transport",
        "pattern": re.compile(r'http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z0-9]'),
        "description": "A plain HTTP URL was found. Use HTTPS to encrypt data in transit.",
    },
    # Sensitive files / .env
    {
        "id": "ENV001",
        "title": "Environment File with Secrets",
        "severity": "high",
        "category": "hardcoded_secret",
        "pattern": re.compile(r'^[A-Z_]+=.+$', re.MULTILINE),
        "description": "Potential secret found in a .env or config file. Ensure this file is in .gitignore.",
        "extensions": {".env"},
    },
]

RECOMMENDATIONS = {
    "SEC001": "Remove the hardcoded value and use environment variables — `os.getenv('PASSWORD')` in Python, `process.env.PASSWORD` in Node.js. Store secrets in a `.env` file (add it to `.gitignore`) and never commit credentials to version control.",
    "SEC002": "Move this value to an environment variable or a secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault). Example: `key = os.getenv('API_KEY')`. Inject secrets through your CI/CD pipeline, never hardcode them.",
    "SEC003": "Revoke this AWS key immediately from the IAM console, then rotate it. Switch to IAM roles for EC2/Lambda, or store credentials in AWS Secrets Manager / environment variables. Run `git filter-repo` to purge it from Git history.",
    "SEC004": "Remove this file from the repository and rotate the key immediately. Run `git filter-repo` to scrub it from history. Add `*.pem`, `*.key`, `id_rsa` to `.gitignore`. Use a secrets manager or SSH agent for key distribution.",
    "SQL001": "Use parameterized queries to prevent injection. Python: `cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))`. Node.js: `db.query('SELECT * FROM users WHERE id = $1', [userId])`. Never use string formatting or f-strings to build SQL queries.",
    "CFG001": "Set `DEBUG = False` for all production deployments. Use: `DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'`. Leaving DEBUG enabled exposes full stack traces, configuration details, and internal data to potential attackers.",
    "CFG002": "Generate a strong secret key: `python -c \"import secrets; print(secrets.token_hex(32))\"`. Store it as an environment variable: `SECRET_KEY = os.getenv('SECRET_KEY')`. A short or predictable key can be brute-forced to forge authentication tokens.",
    "PY001": "Replace `eval()` with `ast.literal_eval()` for safe parsing of Python literals. For dynamic dispatch, use a function map: `{'action': fn}[input]()`. Never pass user-controlled data to `eval()` — it executes any Python code.",
    "PY002": "Redesign to avoid `exec()`. Use a function dispatch table, `importlib`, or a class-based plugin system. If `exec()` is unavoidable, restrict the namespace strictly: `exec(code, {'__builtins__': {}})` and validate all inputs.",
    "PY003": "Replace pickle with `json` or `msgpack` for safe serialization. Pickle can execute arbitrary code during deserialization. If pickle is required for internal caching, never deserialize data received from external or untrusted sources.",
    "PY004": "Use `shell=False` with a list of arguments: `subprocess.run(['cmd', 'arg1', arg2], shell=False, check=True)`. This bypasses shell interpretation entirely and prevents injection through user-controlled arguments.",
    "PY005": "Replace with `subprocess.run(['cmd', 'arg'], shell=False, check=True, capture_output=True)`. It is safer, more portable, avoids shell interpretation, and gives you proper control over stdout/stderr.",
    "JS001": "Use `element.textContent = data` for plain text. If HTML is required, sanitize first: `element.innerHTML = DOMPurify.sanitize(data)`. Install via `npm install dompurify`. Never assign raw user input to `innerHTML`.",
    "JS002": "Sanitize before rendering: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}`. Install: `npm install dompurify`. Consider using a safe renderer like `react-markdown` with `rehype-sanitize` instead.",
    "JS003": "Replace `eval()` with `JSON.parse()` for JSON data, or use a safe function dispatch map: `const fns = { add: (a,b) => a+b }; fns[name]?.(args)`. Never pass user-controlled strings to `eval()`.",
    "CRY001": "Replace MD5 with SHA-256: Python: `hashlib.sha256(data).hexdigest()`, Node.js: `crypto.createHash('sha256').update(data).digest('hex')`. For password hashing, use bcrypt or argon2id — never a raw hash function.",
    "CRY002": "Replace SHA-1 with SHA-256 or stronger. Python: `hashlib.sha256(data).hexdigest()`. For password hashing, use bcrypt or argon2id. SHA-1 has been vulnerable to collision attacks since 2017 and is considered broken.",
    "NET001": "Replace `http://` with `https://`. Obtain a free TLS certificate via Let's Encrypt (certbot). Add HSTS headers to enforce HTTPS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
    "ENV001": "Add `.env` to `.gitignore` immediately. If already committed, rotate all exposed secrets now — assume they are compromised. Store secrets as CI/CD variables (GitHub Secrets, GitLab CI Variables) and inject them at runtime.",
}

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
SEVERITY_COLORS = {
    "critical": "\033[91m",
    "high": "\033[31m",
    "medium": "\033[33m",
    "low": "\033[34m",
    "info": "\033[37m",
}
RESET = "\033[0m"
BOLD = "\033[1m"


# ─── Scanner Logic ────────────────────────────────────────────────────────────

def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS or part.startswith("."):
            return True
    return False


def is_scannable(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_EXTENSIONS and path.name not in SKIP_FILES


def scan_file(path: Path, base: Path) -> list:
    findings = []
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return findings

    rel = str(path.relative_to(base))
    lines = content.splitlines()
    ext = path.suffix.lower()

    for rule in REGEX_RULES:
        # Some rules are extension-specific
        if "extensions" in rule and ext not in rule["extensions"]:
            continue

        for match in rule["pattern"].finditer(content):
            # Find line number
            line_no = content[: match.start()].count("\n") + 1
            code_snippet = lines[line_no - 1].strip() if line_no <= len(lines) else ""

            # Suppress false positives: skip comment lines
            stripped = code_snippet.lstrip()
            if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
                continue

            findings.append(
                {
                    "id": str(uuid.uuid4()),
                    "rule_id": rule["id"],
                    "title": rule["title"],
                    "severity": rule["severity"],
                    "category": rule["category"],
                    "description": rule["description"],
                    "recommendation": RECOMMENDATIONS.get(rule["id"], ""),
                    "file": rel,
                    "line": line_no,
                    "code": code_snippet[:200],
                }
            )

    return findings


def scan_directory(directory: str) -> dict:
    base = Path(directory).resolve()
    if not base.is_dir():
        print(f"[ERROR] Not a directory: {base}")
        sys.exit(1)

    total_files = 0
    scanned_files = 0
    all_findings = []

    print(f"\n{BOLD}InvisiThreat Scanner v{VERSION}{RESET}")
    print(f"Scanning: {base}\n")

    for path in sorted(base.rglob("*")):
        if path.is_dir():
            continue
        total_files += 1
        rel = path.relative_to(base)
        if should_skip(rel) or not is_scannable(path):
            continue
        scanned_files += 1
        findings = scan_file(path, base)
        if findings:
            all_findings.extend(findings)

    # Deduplicate by (rule_id, file, line)
    seen = set()
    unique = []
    for f in all_findings:
        key = (f["rule_id"], f["file"], f["line"])
        if key not in seen:
            seen.add(key)
            unique.append(f)

    # Sort by severity
    unique.sort(key=lambda x: SEVERITY_ORDER.get(x["severity"], 99))

    # Count by severity
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in unique:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    return {
        "findings": unique,
        "summary": {
            "total": len(unique),
            "critical": counts["critical"],
            "high": counts["high"],
            "medium": counts["medium"],
            "low": counts["low"],
            "info": counts["info"],
            "total_files": total_files,
            "scanned_files": scanned_files,
            "tool": "invisithreat-cli",
            "version": VERSION,
        },
    }


def print_results(results: dict):
    findings = results["findings"]
    summary = results["summary"]

    if not findings:
        print(f"\033[92m[OK] No issues found in {summary['scanned_files']} files.{RESET}\n")
        return

    print(f"\n{BOLD}Findings ({summary['total']} total):{RESET}\n")

    current_severity = None
    for f in findings:
        if f["severity"] != current_severity:
            current_severity = f["severity"]
            color = SEVERITY_COLORS.get(current_severity, "")
            print(f"{color}{BOLD}  {current_severity.upper()}{RESET}")

        color = SEVERITY_COLORS.get(f["severity"], "")
        print(f"  {color}[{f['rule_id']}]{RESET} {f['title']}")
        print(f"         {f['file']}:{f['line']}")
        print(f"         {BOLD}{f['code']}{RESET}")
        print()

    print(f"{'─'*50}")
    print(f"{BOLD}Summary:{RESET}")
    for sev in ["critical", "high", "medium", "low"]:
        cnt = summary[sev]
        if cnt:
            color = SEVERITY_COLORS[sev]
            print(f"  {color}{sev.capitalize():10}{RESET} {cnt}")
    print(f"  Files scanned: {summary['scanned_files']} / {summary['total_files']}")
    print()


def upload_results(token: str, results: dict, api_url: str):
    url = f"{api_url.rstrip('/')}/api/projects/scans/upload"
    payload = {
        "upload_token": token,
        "results_json": json.dumps(results),
        "status": "completed",
        "error_message": None,
    }
    print(f"Uploading results to {url} ...")
    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        print(f"\033[92m[OK] Results uploaded. Scan ID: {data.get('scan_id')}{RESET}")
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Cannot connect to {api_url}. Is the server running?")
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"[ERROR] Upload failed: {e.response.status_code} — {e.response.text}")
        sys.exit(1)


# ─── Entry Point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="InvisiThreat CLI Scanner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("directory", nargs="?", default=".", help="Directory to scan (default: current dir)")
    parser.add_argument("--token", "-t", required=False, help="Upload token from the platform")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"API base URL (default: {DEFAULT_API_URL})")
    parser.add_argument("--output", "-o", help="Save results to a JSON file (optional)")
    parser.add_argument("--no-upload", action="store_true", help="Scan only, do not upload results")
    args = parser.parse_args()

    if not args.no_upload and not args.token:
        print("[ERROR] --token is required unless --no-upload is specified.")
        print("  Get a token from the platform: New Scan -> CLI -> copy the token.")
        sys.exit(1)

    results = scan_directory(args.directory)
    print_results(results)

    if args.output:
        Path(args.output).write_text(json.dumps(results, indent=2))
        print(f"Results saved to {args.output}")

    if not args.no_upload:
        upload_results(args.token, results, args.api_url)


if __name__ == "__main__":
    main()
