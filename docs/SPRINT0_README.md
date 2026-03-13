# InvisiThreat — Sprint 0 Documentation

## What is InvisiThreat?

InvisiThreat is a **DevSecOps platform** that helps developers automatically detect
security vulnerabilities in their code. Instead of waiting for a manual security audit,
you scan your project and get an instant report of all potential risks.

---

## Sprint 0 — What was built

This is the first sprint (initial setup). Here is everything that was implemented:

---

### 1. Backend API (FastAPI + PostgreSQL + Docker)

The server is built with **FastAPI** (Python) and uses **PostgreSQL** as a database.
Everything runs inside **Docker** so you don't need to install anything manually.

**To start the full stack:**
```bash
cd C:\Users\Wiem\invisithreat
docker-compose up --build
```

| Service | URL |
|---|---|
| API | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/api/docs |
| Health check | http://localhost:8000/api/health |

---

### 2. Authentication System (JWT)

Users can register, login, and access protected routes using **JWT tokens**
(industry-standard secure tokens). Both an access token and a refresh token are returned.

| Endpoint | Method | What it does |
|---|---|---|
| `/api/auth/register` | POST | Create a new account |
| `/api/auth/login` | POST | Login and get tokens |
| `/api/auth/refresh` | POST | Get a new access token |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Get current user info |

**Test accounts already available in the database:**

| Email | Password | Role |
|---|---|---|
| `admin@invisithreat.dev` | `SecurePass@2024` | Admin |
| `security@invisithreat.dev` | `SecurePass@2024` | Security Manager |
| `testuser@invisithreat.dev` | `SecurePass@2024` | Developer |
| `viewer@invisithreat.dev` | `SecurePass@2024` | Viewer |

---

### 3. CLI Security Scanner

A command-line tool that **scans any project folder** on your machine and reports
security vulnerabilities found in the code — no installation required, just Python 3.8+.

---

## CLI Scanner — How to use it

### Step 1 — Open a terminal and go to the InvisiThreat folder

```bash
cd C:\Users\Wiem\invisithreat
```

> You always need to start from this folder because the scanner (`cli/scanner.py`) lives here.
> But the **project you want to scan** can be anywhere on your computer.

---

### Step 2 — Run the scan on any project

```bash
# Scan a project on your Desktop
python cli/scanner.py "C:\Users\Wiem\Desktop\my-project"

# Scan a project in Documents
python cli/scanner.py "C:\Users\Wiem\Documents\my-api"

# Scan the InvisiThreat backend itself
python cli/scanner.py ./backend

# Scan current directory
python cli/scanner.py .
```

> **Important:** If your folder path contains spaces, always wrap it in quotes.
>
> Wrong:  `python cli/scanner.py C:\Users\Wiem\final project\app`
>
> Correct: `python cli/scanner.py "C:\Users\Wiem\final project\app"`

---

### Step 3 — Read the results

The scanner displays a colored report directly in your terminal:

```
Target  : C:\Users\Wiem\my-project
Files   : 42 scanned
Issues  : 8

[CRITICAL]  Hardcoded Password  [SEC-001]
  Line 12  |  password = "admin123"
  A hardcoded password was found. Move secrets to environment variables.

[HIGH]  SQL Injection Risk  [SQL-001]
  Line 47  |  query = "SELECT * FROM users WHERE id=" + user_id
  String formatting in SQL queries can lead to SQL injection.
```

---

### Available options

| Command | What it does |
|---|---|
| `python cli/scanner.py ./myproject` | Scan and show all findings |
| `python cli/scanner.py ./myproject --severity HIGH` | Show only HIGH and CRITICAL |
| `python cli/scanner.py ./myproject --severity MEDIUM` | Show MEDIUM, HIGH and CRITICAL |
| `python cli/scanner.py ./myproject --format json` | Output results as JSON |

---

### Severity levels

| Level | Meaning | What to do |
|---|---|---|
| **CRITICAL** | Immediate danger in your code | Fix right now, do not deploy |
| **HIGH** | Serious security risk | Fix before the next release |
| **MEDIUM** | Potential issue | Plan a fix soon |
| **LOW** | Minor concern | Fix when possible |
| **INFO** | Good to know | No urgent action needed |

---

### What vulnerabilities does the scanner detect?

| Rule ID | Severity | What it detects | Applies to |
|---|---|---|---|
| SEC-001 | CRITICAL | Hardcoded passwords in code | All files |
| SEC-002 | CRITICAL | Hardcoded API keys / secrets | All files |
| SEC-003 | HIGH | AWS credentials in code | All files |
| SEC-004 | HIGH | Private key blocks in code | All files |
| SEC-005 | HIGH | Hardcoded JWT secrets | All files |
| ENV-001 | CRITICAL | Secrets in `.env` files | `.env` files |
| CODE-001 | HIGH | `eval()` — executes arbitrary code | Python / JS |
| CODE-002 | HIGH | `exec()` — executes arbitrary code | Python |
| CODE-003 | HIGH | `os.system()` — shell injection risk | Python |
| CODE-004 | MEDIUM | `subprocess` with `shell=True` | Python |
| CODE-005 | MEDIUM | `pickle.loads()` — unsafe deserialization | Python |
| SQL-001 | HIGH | SQL injection via string formatting | Python / JS |
| SQL-002 | MEDIUM | f-strings used directly in SQL queries | Python |
| NET-001 | MEDIUM | Insecure HTTP URLs (should be HTTPS) | All files |
| CRYPTO-001 | HIGH | MD5 hashing (broken algorithm) | Python |
| CRYPTO-002 | HIGH | SHA1 hashing (broken algorithm) | Python |
| CFG-001 | HIGH | `DEBUG=True` left on in production | Python |
| CFG-002 | MEDIUM | Hardcoded IP addresses | All files |
| CFG-003 | LOW | Security-related TODO comments | All files |
| JS-001 | HIGH | `dangerouslySetInnerHTML` — XSS risk | React / JS |
| JS-002 | HIGH | `document.write()` — XSS risk | JavaScript |
| JS-003 | MEDIUM | Tokens stored in `localStorage` | JavaScript |
| JS-004 | MEDIUM | `console.log` printing sensitive data | JavaScript |

---

### Supported file types

The scanner automatically picks the right rules based on the file extension:

| File type | Extensions |
|---|---|
| Python | `.py` |
| JavaScript / TypeScript | `.js`, `.ts`, `.jsx`, `.tsx` |
| Environment config | `.env` |
| Config files | `.yml`, `.yaml`, `.json`, `.toml`, `.ini`, `.cfg` |
| Shell scripts | `.sh`, `.bash` |

It automatically **ignores** these folders: `node_modules/`, `.git/`, `venv/`,
`__pycache__/`, `dist/`, `build/` — so scans stay fast and relevant.

---

### Exit codes

The scanner returns an exit code so it can be used in CI/CD pipelines:

| Exit code | Meaning |
|---|---|
| `0` | No CRITICAL or HIGH issues found — safe to deploy |
| `1` | At least one CRITICAL or HIGH issue found — review before deploying |

Example — block a deployment automatically if issues are found:
```bash
python cli/scanner.py . || echo "Security issues found — deployment blocked"
```

---

## Requirements

- Python 3.8 or higher
- No external packages needed — uses only the Python standard library
- Works on Windows, macOS, and Linux
