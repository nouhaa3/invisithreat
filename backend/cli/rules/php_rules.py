"""
PHP vulnerability detection rules
"""

RULES = [
    {
        "name": "SQL Injection",
        "pattern": r"\$_?GET|\$_?POST|\$_?REQUEST.*\.|\$query.*\\\$|mysqli_query.*\\\$",
        "severity": "HIGH",
        "description": "SQL query using unsanitized user input.",
        "category": "Injection",
    },
    {
        "name": "Command Injection",
        "pattern": r"shell_exec|exec|system|passthru|proc_open.*\\\$",
        "severity": "CRITICAL",
        "description": "User input passed to command execution function.",
        "category": "Code Execution",
    },
    {
        "name": "Hardcoded Credentials",
        "pattern": r"password\s*=\s*[\"']([^\"']{6,})[\"']|\$password\s*=",
        "severity": "CRITICAL",
        "description": "Hardcoded password or database credentials.",
        "category": "Secrets",
    },
    {
        "name": "XSS Vulnerability",
        "pattern": r"echo\s+\$_|print\s+\$_|<\?=\s*\$_",
        "severity": "HIGH",
        "description": "Unfiltered user input echoed to output.",
        "category": "XSS",
    },
    {
        "name": "Weak Hashing",
        "pattern": r"md5\(|sha1\(|crypt\(",
        "severity": "HIGH",
        "description": "Weak hashing function used for passwords.",
        "category": "Cryptography",
    },
    {
        "name": "Directory Traversal",
        "pattern": r"include\s+\$_|require\s+\$_|file_get_contents.*\$_",
        "severity": "HIGH",
        "description": "Potential directory traversal via input.",
        "category": "Path Traversal",
    },
]
