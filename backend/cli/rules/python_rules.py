"""
Python-specific vulnerability detection rules
"""

PYTHON_RULES = [
    # --- Injection ---
    {
        "id": "PY001",
        "name": "SQL Injection Risk",
        "severity": "CRITICAL",
        "pattern": r"(execute|raw|cursor\.execute)\s*\(\s*[f\"'].*%|\.format\(",
        "description": "String formatting in SQL query — use parameterized queries instead.",
        "category": "Injection",
        "fix": "Use parameterized queries: cursor.execute('SELECT * FROM t WHERE id=%s', (val,))",
    },
    {
        "id": "PY002",
        "name": "Command Injection",
        "severity": "CRITICAL",
        "pattern": r"(os\.system|subprocess\.call|subprocess\.run|popen)\s*\(.*(\+|f[\"']|format)",
        "description": "User input may be passed to a shell command.",
        "category": "Injection",
        "fix": "Use subprocess with a list of args and shell=False.",
    },
    {
        "id": "PY003",
        "name": "Eval / Exec Usage",
        "severity": "HIGH",
        "pattern": r"\beval\s*\(|\bexec\s*\(",
        "description": "eval()/exec() can execute arbitrary code.",
        "category": "Code Execution",
        "fix": "Avoid eval/exec. Use ast.literal_eval() for safe evaluation.",
    },
    # --- Cryptography ---
    {
        "id": "PY004",
        "name": "Weak Hashing Algorithm (MD5/SHA1)",
        "severity": "HIGH",
        "pattern": r"hashlib\.(md5|sha1)\s*\(",
        "description": "MD5 and SHA1 are cryptographically broken.",
        "category": "Cryptography",
        "fix": "Use hashlib.sha256() or hashlib.sha512() instead.",
    },
    {
        "id": "PY005",
        "name": "Hardcoded Secret / Password",
        "severity": "HIGH",
        "pattern": r"(password|secret|api_key|token|passwd)\s*=\s*[\"'][^\"']{4,}[\"']",
        "description": "Hardcoded credential found in source code.",
        "category": "Secrets",
        "fix": "Use environment variables or a secrets manager.",
    },
    # --- Deserialization ---
    {
        "id": "PY006",
        "name": "Unsafe Pickle Deserialization",
        "severity": "CRITICAL",
        "pattern": r"\bpickle\.loads?\s*\(|\b__reduce__\s*\(",
        "description": "pickle.load() can execute arbitrary code on untrusted input.",
        "category": "Deserialization",
        "fix": "Use JSON or another safe serialization format.",
    },
    {
        "id": "PY007",
        "name": "YAML Unsafe Load",
        "severity": "HIGH",
        "pattern": r"yaml\.load\s*\([^,)]+\)",
        "description": "yaml.load() without Loader is unsafe.",
        "category": "Deserialization",
        "fix": "Use yaml.safe_load() instead.",
    },
    # --- Cryptography ---
    {
        "id": "PY008",
        "name": "SSL Verification Disabled",
        "severity": "HIGH",
        "pattern": r"verify\s*=\s*False",
        "description": "SSL certificate verification is disabled.",
        "category": "Cryptography",
        "fix": "Remove verify=False or provide a proper CA bundle.",
    },
    {
        "id": "PY009",
        "name": "Debug Mode Enabled",
        "severity": "MEDIUM",
        "pattern": r"(DEBUG\s*=\s*True|app\.run\s*\(.*debug\s*=\s*True)",
        "description": "Debug mode should never be enabled in production.",
        "category": "Configuration",
        "fix": "Set DEBUG=False and use environment-based config.",
    },
    {
        "id": "PY010",
        "name": "Assert Used for Security Check",
        "severity": "MEDIUM",
        "pattern": r"\bassert\s+.*(auth|permission|user|role|admin|is_active)",
        "description": "assert statements are stripped in optimized bytecode (-O flag).",
        "category": "Access Control",
        "fix": "Use explicit if/raise statements for security checks.",
    },
    # --- Randomness ---
    {
        "id": "PY011",
        "name": "Insecure Random Number Generator",
        "severity": "MEDIUM",
        "pattern": r"\brandom\.(random|randint|choice|shuffle)\s*\(",
        "description": "random module is not cryptographically secure.",
        "category": "Cryptography",
        "fix": "Use secrets module for security-sensitive randomness.",
    },
    # --- Path Traversal ---
    {
        "id": "PY012",
        "name": "Path Traversal Risk",
        "severity": "HIGH",
        "pattern": r"open\s*\(\s*(request\.|input\(|f[\"']|.*\+)",
        "description": "User-controlled input used in file path.",
        "category": "Path Traversal",
        "fix": "Validate and sanitize file paths. Use os.path.abspath() and check prefix.",
    },
]
