"""
Rust vulnerability detection rules
"""

RULES = [
    {
        "name": "Unsafe Code Block",
        "pattern": r"unsafe\s*\{",
        "severity": "MEDIUM",
        "description": "Unsafe code block detected — ensure it is necessary and reviewed.",
        "category": "Code Quality",
    },
    {
        "name": "Hardcoded Secret",
        "pattern": r"const\s+\w+\s*[:=]\s*[\"']([a-zA-Z0-9\-_]{20,})[\"']",
        "severity": "CRITICAL",
        "description": "Hardcoded secret in constant declaration.",
        "category": "Secrets",
    },
    {
        "name": "SQL Injection",
        "pattern": r"query\s*\(&|format!\s*\(.*SELECT.*[+\*]|sqlx::",
        "severity": "HIGH",
        "description": "SQL query constructed with user input.",
        "category": "Injection",
    },
    {
        "name": "Weak Cryptography",
        "pattern": r"md5|MD5|sha1|SHA1",
        "severity": "HIGH",
        "description": "Weak hashing algorithm.",
        "category": "Cryptography",
    },
    {
        "name": "Deprecated Crypto",
        "pattern": r"openssl|deprecated",
        "severity": "MEDIUM",
        "description": "Deprecated or potentially unsafe cryptography library.",
        "category": "Cryptography",
    },
]
