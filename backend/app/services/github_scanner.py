"""
GitHub Scanner Background Service
Clones a GitHub repository into a temp directory, runs the InvisiThreat
security rules against it, stores results in the database, then cleans up.
"""
import json
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.scan import Scan, ScanStatus


# ─── Detection Rules (mirrors scripts/scan.py) ───────────────────────────────

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

REGEX_RULES = [
    {"id": "SEC001", "title": "Hardcoded Password", "severity": "high",
     "category": "hardcoded_secret",
     "pattern": re.compile(r'(?i)(password|passwd|pwd)\s*=\s*["\'][^"\']{4,}["\']'),
     "description": "A hardcoded password was found. Use environment variables instead."},
    {"id": "SEC002", "title": "Hardcoded API Key or Secret", "severity": "high",
     "category": "hardcoded_secret",
     "pattern": re.compile(r'(?i)(api_key|apikey|secret_key|secret|token|access_key|private_key)\s*=\s*["\'][A-Za-z0-9+/=_\-]{8,}["\']'),
     "description": "A hardcoded API key or secret was found."},
    {"id": "SEC003", "title": "Hardcoded AWS Key", "severity": "critical",
     "category": "hardcoded_secret",
     "pattern": re.compile(r'AKIA[0-9A-Z]{16}'),
     "description": "An AWS Access Key ID was found hardcoded in source code."},
    {"id": "SEC004", "title": "Hardcoded Private Key", "severity": "critical",
     "category": "hardcoded_secret",
     "pattern": re.compile(r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
     "description": "A private key was found hardcoded. Never commit private keys."},
    {"id": "SQL001", "title": "Potential SQL Injection", "severity": "high",
     "category": "sql_injection",
     "pattern": re.compile(r'(execute|query|raw)\s*\(\s*["\'].*?(SELECT|INSERT|UPDATE|DELETE|DROP).*?["\'\s]*%\s*(s|d)|f["\'].*?(SELECT|INSERT|UPDATE|DELETE).*?\{', re.IGNORECASE),
     "description": "String formatting used to build a SQL query — use parameterized queries instead."},
    {"id": "CFG001", "title": "Debug Mode Enabled", "severity": "medium",
     "category": "configuration",
     "pattern": re.compile(r'(?i)\bDEBUG\s*=\s*True\b'),
     "description": "DEBUG=True found. Ensure this is not deployed to production."},
    {"id": "CFG002", "title": "Weak Secret Key", "severity": "high",
     "category": "configuration",
     "pattern": re.compile(r'(?i)SECRET_KEY\s*=\s*["\'][^"\']{1,20}["\']'),
     "description": "A short or weak SECRET_KEY was found."},
    {"id": "PY001", "title": "Use of eval()", "severity": "high",
     "category": "code_injection",
     "pattern": re.compile(r'\beval\s*\('),
     "description": "eval() can execute arbitrary code."},
    {"id": "PY002", "title": "Use of exec()", "severity": "high",
     "category": "code_injection",
     "pattern": re.compile(r'\bexec\s*\('),
     "description": "exec() can execute arbitrary code."},
    {"id": "PY003", "title": "Pickle Deserialization", "severity": "high",
     "category": "deserialization",
     "pattern": re.compile(r'\bpickle\.(loads?|Unpickler)\b'),
     "description": "Deserializing untrusted pickle data can lead to RCE."},
    {"id": "PY004", "title": "Shell Injection Risk (subprocess)", "severity": "medium",
     "category": "command_injection",
     "pattern": re.compile(r'subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True'),
     "description": "subprocess called with shell=True."},
    {"id": "PY005", "title": "Use of os.system()", "severity": "medium",
     "category": "command_injection",
     "pattern": re.compile(r'\bos\.system\s*\('),
     "description": "os.system() can be dangerous with user input."},
    {"id": "JS001", "title": "Use of innerHTML", "severity": "medium",
     "category": "xss",
     "pattern": re.compile(r'\.innerHTML\s*='),
     "description": "Setting innerHTML with user data can lead to XSS."},
    {"id": "JS002", "title": "Use of dangerouslySetInnerHTML", "severity": "medium",
     "category": "xss",
     "pattern": re.compile(r'dangerouslySetInnerHTML'),
     "description": "dangerouslySetInnerHTML bypasses React XSS protection."},
    {"id": "JS003", "title": "eval() in JavaScript", "severity": "high",
     "category": "code_injection",
     "pattern": re.compile(r'\beval\s*\('),
     "description": "eval() in JavaScript executes arbitrary code."},
    {"id": "CRY001", "title": "Use of MD5", "severity": "medium",
     "category": "weak_cryptography",
     "pattern": re.compile(r'\bmd5\b', re.IGNORECASE),
     "description": "MD5 is cryptographically broken."},
    {"id": "CRY002", "title": "Use of SHA1", "severity": "low",
     "category": "weak_cryptography",
     "pattern": re.compile(r'\bsha1\b', re.IGNORECASE),
     "description": "SHA-1 is deprecated for security use."},
    {"id": "NET001", "title": "HTTP URL (not HTTPS)", "severity": "low",
     "category": "insecure_transport",
     "pattern": re.compile(r'http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z0-9]'),
     "description": "A plain HTTP URL was found. Use HTTPS."},
    {"id": "ENV001", "title": "Environment File with Secrets", "severity": "high",
     "category": "hardcoded_secret",
     "pattern": re.compile(r'^[A-Z_]+=.+$', re.MULTILINE),
     "description": "Potential secret in .env or config file.",
     "extensions": {".env"}},
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


# ─── Scan Helpers ─────────────────────────────────────────────────────────────

def _should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS or (part.startswith(".") and part != "."):
            return True
    return False


def _scan_file(path: Path, base: Path) -> list:
    findings = []
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return findings

    rel = str(path.relative_to(base))
    lines = content.splitlines()
    ext = path.suffix.lower()

    for rule in REGEX_RULES:
        if "extensions" in rule and ext not in rule["extensions"]:
            continue
        for match in rule["pattern"].finditer(content):
            line_no = content[: match.start()].count("\n") + 1
            code_snippet = lines[line_no - 1].strip() if line_no <= len(lines) else ""
            stripped = code_snippet.lstrip()
            if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
                continue
            findings.append({
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
            })
    return findings


def _scan_directory(base: Path) -> dict:
    all_findings = []
    scanned = 0

    for path in sorted(base.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(base)
        if _should_skip(rel) or path.suffix.lower() not in SUPPORTED_EXTENSIONS or path.name in SKIP_FILES:
            continue
        scanned += 1
        all_findings.extend(_scan_file(path, base))

    # Deduplicate
    seen, unique = set(), []
    for f in all_findings:
        key = (f["rule_id"], f["file"], f["line"])
        if key not in seen:
            seen.add(key)
            unique.append(f)

    unique.sort(key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(x["severity"], 4))

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in unique:
        if f["severity"] in counts:
            counts[f["severity"]] += 1

    return {
        "findings": unique,
        "summary": {
            "total_findings": len(unique),
            "scanned_files": scanned,
            **counts,
        },
    }


# ─── Background Task Entry Point ─────────────────────────────────────────────

def run_github_scan(scan_id: str, repo_url: str, branch: str, db_url: str) -> None:
    """
    Runs in a FastAPI BackgroundTask (separate thread).
    Creates its own DB session to avoid cross-thread SQLAlchemy issues.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db: Session = SessionLocal()

    tmpdir = None
    try:
        # ── 1. Mark scan as running ──────────────────────────────────────────
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            return
        scan.status = ScanStatus.running
        db.commit()

        # ── 2. Clone repo ───────────────────────────────────────────────────
        tmpdir = tempfile.mkdtemp(prefix="invisithreat_")
        clone_result = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, repo_url, tmpdir],
            capture_output=True, text=True, timeout=120,
        )

        if clone_result.returncode != 0:
            # Try without branch specifier (fallback for default branch)
            shutil.rmtree(tmpdir, ignore_errors=True)
            tmpdir = tempfile.mkdtemp(prefix="invisithreat_")
            clone_result = subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, tmpdir],
                capture_output=True, text=True, timeout=120,
            )

        if clone_result.returncode != 0:
            raise RuntimeError(f"git clone failed: {clone_result.stderr[:500]}")

        # ── 3. Scan cloned repo ─────────────────────────────────────────────
        results = _scan_directory(Path(tmpdir))

        # ── 4. Save results ─────────────────────────────────────────────────
        scan.status = ScanStatus.completed
        scan.results_json = json.dumps(results)
        scan.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:
        try:
            scan = db.query(Scan).filter(Scan.id == scan_id).first()
            if scan:
                scan.status = ScanStatus.failed
                scan.results_json = json.dumps({"error": str(exc), "findings": [], "summary": {"total_findings": 0, "scanned_files": 0}})
                scan.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)
