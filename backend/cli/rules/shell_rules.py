"""
Shell Script (Bash/PowerShell) vulnerability detection rules
"""

RULES = [
    {
        "name": "Command Injection",
        "pattern": r"\$\(|`|eval\s+|exec\s+|\|\s*bash|\|\s*sh|eval\s*\(|\$\{.*\}",
        "severity": "CRITICAL",
        "description": "Dynamic command execution with user input.",
        "category": "Code Execution",
    },
    {
        "name": "Hardcoded Credentials",
        "pattern": r"export\s+PASSWORD|password\s*=|API_KEY\s*=|SECRET\s*=|TOKEN\s*=['\"]",
        "severity": "CRITICAL",
        "description": "Hardcoded credentials in script.",
        "category": "Secrets",
    },
    {
        "name": "Unquoted Variables",
        "pattern": r"\\\$\w+\s*(?=[<>]|;|\||&&|\|\||&)|echo\s+\\\$",
        "severity": "HIGH",
        "description": "Unquoted variable expansion can lead to word splitting.",
        "category": "Code Quality",
    },
    {
        "name": "SQL Injection in Scripts",
        "pattern": r"mysql|psql|sqlite3.*['\"].*\\\$|.*SELECT.*WHERE.*=.*\\\$",
        "severity": "HIGH",
        "description": "SQL query with shell variable injection.",
        "category": "Injection",
    },
    {
        "name": "Unsafe Use of eval",
        "pattern": r"eval\s+['\"]|eval\s*\(|eval\s+\\\$",
        "severity": "CRITICAL",
        "description": "Use of eval is dangerous and should be avoided.",
        "category": "Code Execution",
    },
    {
        "name": "Missing Quotes",
        "pattern": r"\[\s*\\\$\w+\s*=|if\s+\\\$|for.*in\s+\\\$",
        "severity": "MEDIUM",
        "description": "Unquoted variables in conditionals.",
        "category": "Code Quality",
    },
    {
        "name": "Weak File Permissions",
        "pattern": r"chmod\s+777|umask\s+000|chmod\s+666",
        "severity": "HIGH",
        "description": "Overly permissive file permissions.",
        "category": "Configuration",
    },
]
