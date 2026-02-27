# InvisiThreat CLI Scanner

A lightweight, zero-dependency security scanner for local project folders.

## Usage

```bash
# Basic scan (console output)
python cli/scanner.py ./backend

# Scan current directory
python cli/scanner.py .

# Show only HIGH and CRITICAL
python cli/scanner.py ./backend --severity HIGH

# JSON output
python cli/scanner.py ./backend --format json

# Save report to file
python cli/scanner.py . --output report.json
```

## Detected Vulnerabilities

| Rule ID     | Severity | What it detects |
|-------------|----------|-----------------|
| SEC-001     | CRITICAL | Hardcoded passwords |
| SEC-002     | CRITICAL | Hardcoded API keys / secrets |
| SEC-003     | HIGH     | AWS credentials in code |
| SEC-004     | HIGH     | Private keys in source |
| SEC-005     | HIGH     | Hardcoded JWT secrets |
| ENV-001     | CRITICAL | Secrets in .env files |
| CODE-001    | HIGH     | `eval()` usage |
| CODE-002    | HIGH     | `exec()` usage |
| CODE-003    | HIGH     | `os.system()` shell injection |
| CODE-004    | MEDIUM   | `subprocess` with `shell=True` |
| CODE-005    | MEDIUM   | `pickle.loads()` deserialization |
| SQL-001     | HIGH     | SQL injection patterns |
| SQL-002     | MEDIUM   | f-strings in SQL queries |
| NET-001     | MEDIUM   | Insecure HTTP URLs |
| CRYPTO-001  | HIGH     | MD5 usage |
| CRYPTO-002  | HIGH     | SHA1 usage |
| CFG-001     | HIGH     | `DEBUG=True` in production |
| CFG-002     | MEDIUM   | Hardcoded IP addresses |
| CFG-003     | LOW      | Security-related TODOs |
| JS-001      | HIGH     | `dangerouslySetInnerHTML` (React XSS) |
| JS-002      | HIGH     | `document.write()` XSS |
| JS-003      | MEDIUM   | Tokens in localStorage |
| JS-004      | MEDIUM   | `console.log` in production |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | No CRITICAL or HIGH findings |
| `1`  | At least one CRITICAL or HIGH finding |

This makes it easy to use in CI/CD pipelines:

```bash
python cli/scanner.py . || echo "Security issues found — blocking build"
```

## Requirements

Python 3.8+ — no external packages needed.
