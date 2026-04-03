"""
Kotlin vulnerability detection rules
"""

RULES = [
    {
        "name": "SQL Injection",
        "pattern": r"query\s*\(|execute.*\$|simpleSqlParameterSource|SELECT.*\$\{",
        "severity": "HIGH",
        "description": "SQL query with string interpolation.",
        "category": "Injection",
    },
    {
        "name": "Hardcoded Secret",
        "pattern": r"val\s+\w+\s*:\s*String\s*=\s*[\"']([a-zA-Z0-9\-_]{20,})[\"']",
        "severity": "CRITICAL",
        "description": "Hardcoded credential or API key.",
        "category": "Secrets",
    },
    {
        "name": "Unsafe Deserialization",
        "pattern": r"ObjectInputStream|readObject|parseJson|Gson|fromJson",
        "severity": "HIGH",
        "description": "Unsafe deserialization of untrusted data.",
        "category": "Deserialization",
    },
    {
        "name": "Weak Crypto",
        "pattern": r"MD5|SHA1|MessageDigest.getInstance",
        "severity": "HIGH",
        "description": "Weak hashing algorithm.",
        "category": "Cryptography",
    },
    {
        "name": "Command Execution",
        "pattern": r"ProcessBuilder|Runtime\.exec|Process|\".*bash",
        "severity": "HIGH",
        "description": "Potential command execution.",
        "category": "Code Execution",
    },
    {
        "name": "Null Safety Violation",
        "pattern": r"!!\s*\.|\.let.*!!|\.run.*!!",
        "severity": "MEDIUM",
        "description": "Unsafe null pointer dereference.",
        "category": "Code Quality",
    },
    {
        "name": "Type Variance Abuse",
        "pattern": r"Any|uncheckedCast|@Suppress|out|in",
        "severity": "MEDIUM",
        "description": "Potential type safety issue.",
        "category": "Code Quality",
    },
    {
        "name": "XXE Vulnerability",
        "pattern": r"DocumentBuilderFactory|SAXParser|XMLReader",
        "severity": "HIGH",
        "description": "Potential XML External Entity vulnerability.",
        "category": "Injection",
    },
]
