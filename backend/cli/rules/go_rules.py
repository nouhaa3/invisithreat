"""
Go vulnerability detection rules
"""

RULES = [
    {
        "name": "SQL Injection",
        "pattern": r"fmt\.\s*Sprintf\s*\([^,]+[+\*]|Query\s*\(\s*[\"'].*[+\*]",
        "severity": "HIGH",
        "description": "SQL query built with string concatenation — vulnerable to injection.",
        "category": "Injection",
    },
    {
        "name": "Hardcoded Credentials",
        "pattern": r"password\s*:=\s*[\"']([^\"']{6,})[\"']|apiKey\s*:=\s*[\"']",
        "severity": "CRITICAL",
        "description": "Hardcoded password or API key.",
        "category": "Secrets",
    },
    {
        "name": "Insecure TLS",
        "pattern": r"InsecureSkipVerify\s*:\s*true|tls\.Config.*InsecureSkip",
        "severity": "HIGH",
        "description": "TLS certificate verification disabled.",
        "category": "Cryptography",
    },
    {
        "name": "Weak Cryptography",
        "pattern": r"md5\.|MD5|sha1\.|SHA1",
        "severity": "HIGH",
        "description": "Weak hashing algorithm used.",
        "category": "Cryptography",
    },
    {
        "name": "Command Injection",
        "pattern": r"exec\.Command|os\.Exec|fmt\.Sprintf.*cmd",
        "severity": "HIGH",
        "description": "Potential command injection via external input.",
        "category": "Code Execution",
    },
    {
        "name": "Exposed Debug Mode",
        "pattern": r"debug\s*=\s*true|Debug\s*=\s*true|pprof",
        "severity": "MEDIUM",
        "description": "Debug mode or profiling enabled in production.",
        "category": "Configuration",
    },
]
