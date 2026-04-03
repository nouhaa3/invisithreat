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

### Supported Languages

| Language | Extensions | Support Status | Vulnerabilities |
|---|---|---|---|
| Python | `.py` | **COMPLET** ✓ | SQL Injection, Code Execution, Hardcoded Secrets, Weak Crypto (12 rules) |
| JavaScript / TypeScript | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` | **COMPLET** ✓ | XSS, Code Execution, Tokens in localStorage, eval/exec (10 rules) |
| Configuration Files | `.yml`, `.yaml`, `.json`, `.toml`, `.ini`, `.cfg`, `.xml`, `.properties`, `.gradle`, `.tf`, `.tfvars`, `.hcl` | **COMPLET** ✓ | Hardcoded Secrets, Exposed Credentials, Misconfiguration (6 rules) |
| Java | `.java`, `.class`, `.jar` | **PARTIAL** ⚠ | Hardcoded Secrets, SQL Injection, Unsafe Deserialization, XXE, Reflection (9 rules) |
| Go | `.go` | **PARTIAL** ⚠ | SQL Injection, Credentials, TLS, Command Injection, Race Conditions, XXE (10 rules) |
| Rust | `.rs` | **PARTIAL** ⚠ | Unsafe Code, Hardcoded Secrets, SQL Injection, Weak Crypto, Integer Overflow (8 rules) |
| PHP | `.php` | **PARTIAL** ⚠ | SQL Injection, Command Injection, Credentials, XSS, Type Juggling, XXE (9 rules) |
| Ruby | `.rb` | **PARTIAL** ⚠ | SQL Injection, Command Injection, Secrets, XSS, Code Eval, Reflection, XXE (9 rules) |
| C / C++ | `.c`, `.cpp`, `.cc`, `.h`, `.hpp` | **PARTIAL** ⚠ | Buffer Overflow, Format String, Use-After-Free, Integer Overflow, Weak Crypto (9 rules) |
| Kotlin | `.kt`, `.kts` | **PARTIAL** ⚠ | SQL Injection, Secrets, Unsafe Deserialization, Weak Crypto, Null Safety, XXE (8 rules) |
| Swift | `.swift` | **PARTIAL** ⚠ | Hardcoded Secrets, SQL Injection, Weak Crypto, Insecure Communication, Force Unwrap, XXE (9 rules) |
| Dart | `.dart` | **PARTIAL** ⚠ | Hardcoded Secrets, SQL Injection, Weak Crypto, Insecure HTTP, Null Safety, XXE (9 rules) |
| C# / .NET | `.cs`, `.csproj`, `.vb` | **PARTIAL** ⚠ | SQL Injection, Unsafe Deserialization, XSS, Weak Crypto, Command Injection (8 rules) |
| Shell Scripts | `.sh`, `.bash`, `.zsh`, `.ps1` | **PARTIAL** ⚠ | Command Injection, Hardcoded Credentials, Unquoted Variables, SQL Injection (7 rules) |

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
