"""
C# / .NET vulnerability detection rules
"""

RULES = [
    {
        "name": "SQL Injection",
        "pattern": r"SqlCommand|ExecuteReader|ExecuteScalar|.*\+\s*['\"]SELECT|string\.Format.*SELECT|String\.Concat.*SELECT",
        "severity": "HIGH",
        "description": "SQL query constructed with string concatenation.",
        "category": "Injection",
    },
    {
        "name": "Hardcoded Credentials",
        "pattern": r"password\s*=\s*['\"]([^'\"]{6,})['\"]|const\s+string\s+.*password|apiKey\s*=\s*['\"]",
        "severity": "CRITICAL",
        "description": "Hardcoded password or API key in source.",
        "category": "Secrets",
    },
    {
        "name": "Unsafe Deserialization",
        "pattern": r"BinaryFormatter|ObjectStateFormatter|LosFormatter|NetDataContractSerializer|ReadObject",
        "severity": "CRITICAL",
        "description": "Unsafe deserialization frameworks (BinaryFormatter is deprecated for security).",
        "category": "Deserialization",
    },
    {
        "name": "XSS via HTML Encode Missing",
        "pattern": r"@Html\.Raw|HtmlHelper.*Raw|\.ToString\(\).*Html",
        "severity": "HIGH",
        "description": "Unescaped HTML output in Razor view.",
        "category": "XSS",
    },
    {
        "name": "Weak Cryptography",
        "pattern": r"MD5|SHA1|DES|TripleDES|RC2",
        "severity": "HIGH",
        "description": "Weak cryptographic algorithm.",
        "category": "Cryptography",
    },
    {
        "name": "Command Injection",
        "pattern": r"ProcessStartInfo|Process\.Start|cmd\.exe|powershell\.exe|.*:\s*cmd",
        "severity": "HIGH",
        "description": "Potential command execution vulnerability.",
        "category": "Code Execution",
    },
    {
        "name": "LDAP Injection",
        "pattern": r"DirectorySearcher|DirectoryEntry|LDAP.*\+|ldap.*filter",
        "severity": "HIGH",
        "description": "Potential LDAP injection vulnerability.",
        "category": "Injection",
    },
    {
        "name": "Unsafe Path Handling",
        "pattern": r"Path\.Combine.*\+|Directory\.GetFiles.*\+|File\.ReadAllText.*\+",
        "severity": "HIGH",
        "description": "Path constructed with untrusted input.",
        "category": "Path Traversal",
    },
]
