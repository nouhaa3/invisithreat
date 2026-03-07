#!/usr/bin/env python3
"""
InvisiThreat Scanner CLI  (scanner.exe)
Scan your local code and push results to the InvisiThreat platform.

Commands:
  login      Save your API key and server URL
  logout     Remove saved credentials
  status     Show current user info
  projects   List your projects
  scan       Scan a local directory and upload results
"""

import os, re, sys, json, time, platform
from pathlib import Path
from dataclasses import dataclass
from typing import List

# ── Third-party (bundled in exe) ──────────────────────────────────────────────
try:
    import click
    import requests
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install click requests")
    sys.exit(1)

# Force UTF-8 on Windows
_stdout_enc = sys.stdout.encoding
if _stdout_enc and str(_stdout_enc).lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass

# ─── Config ───────────────────────────────────────────────────────────────────

CONFIG_DIR  = Path.home() / ".invisithreat"
CONFIG_FILE = CONFIG_DIR / "config.json"

def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

def save_config(cfg: dict):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

def get_creds():
    cfg = load_config()
    return cfg.get("server"), cfg.get("token")

# ─── Colors ───────────────────────────────────────────────────────────────────

def _color(text, code):
    if platform.system() == "Windows" and not os.environ.get("TERM"):
        return text
    return f"\033[{code}m{text}\033[0m"

def red(t):    return _color(t, "91")
def green(t):  return _color(t, "92")
def yellow(t): return _color(t, "93")
def orange(t): return _color(t, "38;5;208")
def bold(t):   return _color(t, "1")
def gray(t):   return _color(t, "90")
def cyan(t):   return _color(t, "96")

SEV_COLOR = {
    "CRITICAL": red,
    "HIGH":     orange,
    "MEDIUM":   yellow,
    "LOW":      cyan,
    "INFO":     gray,
}

# ─── API client ───────────────────────────────────────────────────────────────

class APIClient:
    def __init__(self, server: str, token: str):
        self.base    = server.rstrip("/")
        self.headers = {"Authorization": f"ApiKey {token}"}

    def get(self, path: str) -> dict:
        r = requests.get(f"{self.base}/api{path}", headers=self.headers, timeout=15)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: dict) -> dict:
        r = requests.post(f"{self.base}/api{path}", json=body, headers=self.headers, timeout=30)
        r.raise_for_status()
        return r.json()

# ─── SAST engine ─────────────────────────────────────────────────────────────

SCANNABLE = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".php", ".rb",
    ".go", ".cs", ".cpp", ".c", ".h", ".env", ".yml", ".yaml",
    ".json", ".xml", ".sh", ".bash", ".tf", ".kt", ".rs", ".swift",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "env", "dist", "build", ".next", ".nuxt", "vendor", "target",
}

RULES = [
    {"id":"SEC-001","sev":"CRITICAL","title":"Hardcoded Password",
     "pat":r'(?i)(password|passwd|pwd)\s*=\s*["\'][^"\']{4,}["\']',
     "desc":"A hardcoded password was found. Move secrets to environment variables.",
     "fix":"Use os.environ.get('PASSWORD') or a secrets manager."},
    {"id":"SEC-002","sev":"CRITICAL","title":"Hardcoded API Key / Secret",
     "pat":r'(?i)(api_key|apikey|secret_key|secret|token)\s*=\s*["\'][A-Za-z0-9_\-\.]{10,}["\']',
     "desc":"Hardcoded API key or secret detected. Use environment variables or a vault.",
     "fix":"Use os.environ.get('API_KEY') instead of hardcoding."},
    {"id":"SEC-003","sev":"HIGH","title":"AWS Credentials in Source",
     "pat":r'(?i)(AWS_SECRET_ACCESS_KEY|aws_access_key_id)\s*=\s*["\'][^"\']+["\']',
     "desc":"AWS credentials should never be hardcoded.",
     "fix":"Use IAM roles or AWS Secrets Manager."},
    {"id":"SEC-004","sev":"HIGH","title":"Private Key in Source",
     "pat":r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
     "desc":"A private key was found in source code.",
     "fix":"Remove the key and regenerate it. Store in a secure vault."},
    {"id":"SEC-005","sev":"HIGH","title":"JWT Secret Hardcoded",
     "pat":r'(?i)(jwt_secret|jwt_key)\s*=\s*["\'][^"\']{4,}["\']',
     "desc":"JWT secret should be loaded from environment.",
     "fix":"Use os.environ.get('JWT_SECRET')."},
    {"id":"SEC-006","sev":"HIGH","title":"Hardcoded Database Password",
     "pat":r'(?i)(db_pass|database_password|db_password|mysql_password)\s*=\s*["\'][^"\']+["\']',
     "desc":"Database credentials hardcoded in source.",
     "fix":"Use environment variables for all database credentials."},
    {"id":"INJ-001","sev":"HIGH","title":"SQL Injection Risk",
     "pat":r'(?i)(execute|query)\s*\(\s*[f"\'].*(%s|{|}|\+)',
     "desc":"Potential SQL injection via string formatting.",
     "fix":"Use parameterized queries: cursor.execute(sql, (param,))"},
    {"id":"INJ-002","sev":"HIGH","title":"Command Injection Risk",
     "pat":r'(?i)(os\.system|subprocess\.call|subprocess\.run|exec)\s*\([^)]*\+[^)]*\)',
     "desc":"Unsanitized input in shell command.",
     "fix":"Use subprocess with a list of args, never shell=True with user input."},
    {"id":"XSS-001","sev":"MEDIUM","title":"Reflected XSS Risk",
     "pat":r'(?i)innerHTML\s*=\s*.*\+',
     "desc":"innerHTML with concatenated strings can lead to XSS.",
     "fix":"Use textContent or sanitize HTML with DOMPurify."},
    {"id":"CFG-001","sev":"MEDIUM","title":"Debug Mode Enabled",
     "pat":r'(?i)DEBUG\s*=\s*(True|1|true)',
     "desc":"Debug mode enabled — exposes stack traces in production.",
     "fix":"Set DEBUG = False or use env variable: DEBUG = os.getenv('DEBUG', 'false') == 'true'"},
    {"id":"CFG-002","sev":"MEDIUM","title":"Weak Secret Key",
     "pat":r'(?i)SECRET_KEY\s*=\s*["\'][^"\']{1,20}["\']',
     "desc":"Short or weak SECRET_KEY found.",
     "fix":"Use secrets.token_hex(32) and load from environment."},
    {"id":"HTTP-001","sev":"LOW","title":"HTTP Instead of HTTPS",
     "pat":r'http://(?!localhost|127\.0\.0\.1)[a-z0-9]',
     "desc":"Plain HTTP URL in source — use HTTPS for production.",
     "fix":"Replace http:// with https://."},
    {"id":"LOG-001","sev":"LOW","title":"Sensitive Data in Log",
     "pat":r'(?i)(log|print|console\.log)\s*\([^)]*(?:password|secret|token|key)[^)]*\)',
     "desc":"Possible sensitive data being logged.",
     "fix":"Redact sensitive fields before logging."},
    {"id":"TLS-001","sev":"HIGH","title":"TLS Verification Disabled",
     "pat":r'verify\s*=\s*False',
     "desc":"SSL/TLS certificate verification is disabled.",
     "fix":"Remove verify=False. If using self-signed certs, pass verify='/path/cert.pem'."},
    {"id":"HASH-001","sev":"MEDIUM","title":"Weak Hashing Algorithm",
     "pat":r'(?i)(md5|sha1)\s*\(',
     "desc":"MD5/SHA-1 are cryptographically weak.",
     "fix":"Use hashlib.sha256() or bcrypt/argon2 for passwords."},
    {"id":"RAND-001","sev":"MEDIUM","title":"Insecure Random",
     "pat":r'\brandom\.(random|randint|choice)\b',
     "desc":"random module is not cryptographically secure.",
     "fix":"Use secrets.token_hex() for security-sensitive randomness."},
    {"id":"PATH-001","sev":"MEDIUM","title":"Path Traversal Risk",
     "pat":r'(?i)open\s*\([^\)]*\+[^\)]*\)',
     "desc":"Potential path traversal vulnerability.",
     "fix":"Validate and sanitize any user-supplied file paths."},
    {"id":"CORS-001","sev":"MEDIUM","title":"CORS Wildcard",
     "pat":r'Access-Control-Allow-Origin["\s:]*\*',
     "desc":"Wildcard CORS header allows requests from any origin.",
     "fix":"Restrict to specific trusted origins."},
    {"id":"EVAL-001","sev":"HIGH","title":"Use of eval()",
     "pat":r'\beval\s*\(',
     "desc":"eval() executes arbitrary code — dangerous if input is untrusted.",
     "fix":"Replace eval() with safer alternatives like ast.literal_eval() for data."},
    {"id":"PICKLE-001","sev":"HIGH","title":"Unsafe Deserialization (pickle)",
     "pat":r'\bpickle\.(load|loads)\s*\(',
     "desc":"pickle.load() on untrusted data can execute arbitrary code.",
     "fix":"Use json.loads() for data serialization or verify the source is trusted."},
]


@dataclass
class Finding:
    rule_id:     str
    severity:    str
    title:       str
    description: str
    file:        str
    line:        int
    snippet:     str = ""
    category:    str = "Security"
    fix:         str = ""


def should_scan(path: Path) -> bool:
    return path.suffix.lower() in SCANNABLE or path.name.startswith(".env")


def scan_file(path: Path, base: Path) -> List[Finding]:
    findings = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return findings
    lines = text.splitlines()
    rel   = str(path.relative_to(base)).replace("\\", "/")
    for rule in RULES:
        pattern = re.compile(rule["pat"])
        for i, line in enumerate(lines, start=1):
            if pattern.search(line):
                findings.append(Finding(
                    rule_id=rule["id"], severity=rule["sev"],
                    title=rule["title"], description=rule["desc"],
                    file=rel, line=i,
                    snippet=line.strip()[:200],
                    fix=rule.get("fix", ""),
                ))
    return findings


def run_scan(target: str) -> tuple:
    base = Path(target).resolve()
    if not base.exists():
        click.echo(red(f"Path does not exist: {target}"))
        sys.exit(1)
    if base.is_file():
        files = [base]
        base  = base.parent
    else:
        files = [
            p for p in base.rglob("*")
            if p.is_file()
            and should_scan(p)
            and not any(skip in p.parts for skip in SKIP_DIRS)
        ]
    findings = []
    for f in files:
        findings.extend(scan_file(f, base))
    return findings, len(files)

# ─── CLI ─────────────────────────────────────────────────────────────────────

BANNER = f"""
{orange(bold("  ██╗███╗   ██╗██╗   ██╗██╗███████╗██╗████████╗██╗  ██╗██████╗ ███████╗ █████╗ ████████╗"))}
{orange(bold("  ██║████╗  ██║██║   ██║██║██╔════╝██║╚══██╔══╝██║  ██║██╔══██╗██╔════╝██╔══██╗╚══██╔══╝"))}
{orange(bold("  ██║██╔██╗ ██║██║   ██║██║███████╗██║   ██║   ███████║██████╔╝█████╗  ███████║   ██║   "))}
{orange(bold("  ██║██║╚██╗██║╚██╗ ██╔╝██║╚════██║██║   ██║   ██╔══██║██╔══██╗██╔══╝  ██╔══██║   ██║   "))}
{orange(bold("  ██║██║ ╚████║ ╚████╔╝ ██║███████║██║   ██║   ██║  ██║██║  ██║███████╗██║  ██║   ██║   "))}
{gray(    "  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ")}
  {gray("Scanner CLI  v1.0.0  —  InvisiThreat DevSecOps Platform")}
"""

@click.group()
def cli():
    """InvisiThreat Scanner — scan local code and push results to the platform."""


@cli.command()
@click.option("--server", default="http://localhost:8000", show_default=True,
              help="Platform URL, e.g. https://invisithreat.example.com")
@click.option("--token",  required=True, prompt="API Key (from Settings → API Keys)",
              hide_input=True, help="Your personal API key (ivt_...)")
def login(server, token):
    """Save your API key and connect to the platform."""
    click.echo(BANNER)
    click.echo(f"  Connecting to {bold(server)} ...")
    client = APIClient(server, token)
    try:
        me = client.get("/auth/cli/me")
    except Exception as e:
        click.echo(red(f"\n  ✗ Connection failed: {e}"))
        click.echo(gray("  Check your server URL and API key."))
        sys.exit(1)
    save_config({"server": server, "token": token})
    click.echo(green(f"\n  ✓ Logged in as {bold(me.get('nom', me.get('email')))} ({me.get('email')})"))
    click.echo(gray(f"  Config saved to {CONFIG_FILE}\n"))


@cli.command()
def logout():
    """Remove saved credentials."""
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
    click.echo(green("  ✓ Logged out. Config removed."))


@cli.command()
def status():
    """Show current user and connection info."""
    server, token = get_creds()
    if not server:
        click.echo(red("  Not logged in. Run: invisithreat login"))
        sys.exit(1)
    client = APIClient(server, token)
    try:
        me = client.get("/auth/cli/me")
    except Exception as e:
        click.echo(red(f"  ✗ {e}"))
        sys.exit(1)
    click.echo(f"\n  {bold('User:')}   {me.get('nom')} ({me.get('email')})")
    click.echo(f"  {bold('Role:')}   {me.get('role_name', 'N/A')}")
    click.echo(f"  {bold('Server:')} {server}\n")


@cli.command()
def projects():
    """List all your projects."""
    server, token = get_creds()
    if not server:
        click.echo(red("  Not logged in. Run: invisithreat login"))
        sys.exit(1)
    client = APIClient(server, token)
    try:
        items = client.get("/cli/projects")
    except Exception as e:
        click.echo(red(f"  ✗ {e}"))
        sys.exit(1)
    if not items:
        click.echo(yellow("  No projects found. Create one in the dashboard."))
        return
    click.echo(f"\n  {bold('Your Projects:')}\n")
    for p in items:
        scans = p.get("scan_count", 0)
        name_padded = p['name'][:35].ljust(35)
        click.echo(f"  {cyan(p['id'][:8]+'...')}  {bold(name_padded)}  {gray(str(scans)+' scan(s)')}")
        if p.get("description"):
            click.echo(f"  {' '*42}{gray(p['description'][:60])}")
    click.echo()


@cli.command()
@click.argument("path", default=".", type=click.Path(exists=True))
@click.option("--project-id", "-p", required=True, help="Project UUID from the platform")
@click.option("--severity", "-s", default=None,
              type=click.Choice(["critical","high","medium","low","info"], case_sensitive=False),
              help="Minimum severity to upload (default: all)")
@click.option("--dry-run", is_flag=True, help="Scan locally but do NOT upload results")
def scan(path, project_id, severity, dry_run):
    """Scan a local directory and upload results to the platform."""
    click.echo(BANNER)
    server, token = get_creds()
    if not server and not dry_run:
        click.echo(red("  Not logged in. Run: invisithreat login  (or use --dry-run)"))
        sys.exit(1)

    abs_path = str(Path(path).resolve())
    click.echo(f"  {bold('Target:')}  {abs_path}")
    click.echo(f"  {bold('Project:')} {project_id}")
    if dry_run:
        click.echo(yellow("  Mode:     DRY RUN (results will not be uploaded)"))
    click.echo(f"\n  {gray('Scanning...')}\n")

    t0 = time.time()
    findings, file_count = run_scan(abs_path)
    duration_ms = (time.time() - t0) * 1000

    # Filter by severity if requested
    SEV_ORDER = {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1}
    if severity:
        min_sev = SEV_ORDER.get(severity.upper(), 0)
        findings = [f for f in findings if SEV_ORDER.get(f.severity, 0) >= min_sev]

    # ── Print results ──────────────────────────────────────────────────────────
    by_sev: dict = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in findings:
        by_sev[f.severity] = by_sev.get(f.severity, 0) + 1

    for f in findings:
        col   = SEV_COLOR.get(f.severity, gray)
        label = f"[{f.severity:<8}]"
        click.echo(f"  {col(label)} {bold(f.title)}")
        click.echo(f"  {gray(' '*12)}{f.file}:{f.line}")
        if f.snippet:
            click.echo(f"  {gray(' '*12)}{gray(f.snippet)}")
        click.echo()

    # ── Summary ──────────────────────────────────────────────────────────────
    click.echo("  " + "─" * 60)
    click.echo(f"  Scanned {bold(str(file_count))} files in {duration_ms:.0f}ms")
    click.echo(f"  Found   {bold(str(len(findings)))} finding(s):")
    for sev, n in by_sev.items():
        if n > 0:
            col = SEV_COLOR.get(sev, gray)
            click.echo(f"    {col(f'{sev:<10}')}  {bold(str(n))}")
    click.echo()

    if not findings:
        click.echo(green("  ✓ No issues found. Clean scan!\n"))
        if not dry_run:
            _upload(server, token, project_id, abs_path, findings, file_count, duration_ms)
        return

    if dry_run:
        click.echo(yellow("  ↳ Dry-run: results not uploaded.\n"))
        return

    _upload(server, token, project_id, abs_path, findings, file_count, duration_ms)


def _upload(server, token, project_id, path, findings, file_count, duration_ms):
    click.echo(f"  {gray('Uploading results...')} ", nl=False)
    client = APIClient(server, token)
    payload = {
        "project_id": project_id,
        "path": path,
        "scanned_files": file_count,
        "duration_ms": duration_ms,
        "findings": [
            {
                "rule_id":     f.rule_id,
                "severity":    f.severity,
                "title":       f.title,
                "description": f.description,
                "file":        f.file,
                "line":        f.line,
                "snippet":     f.snippet,
                "category":    f.category,
                "fix":         f.fix,
            }
            for f in findings
        ],
    }
    try:
        resp = client.post("/cli/scan", payload)
        click.echo(green("done"))
        click.echo(green(f"\n  ✓ Scan saved!  {len(findings)} finding(s) uploaded."))
        click.echo(f"  View results → {server}{resp.get('url', '')}\n")
    except requests.HTTPError as e:
        click.echo(red(f"failed\n  ✗ Upload error: {e.response.status_code} {e.response.text}"))
    except Exception as e:
        click.echo(red(f"failed\n  ✗ {e}"))


if __name__ == "__main__":
    cli()
