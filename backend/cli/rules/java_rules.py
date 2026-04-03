"""
Java vulnerability detection rules
"""

RULES = [
    {
        "name": "Hardcoded Password",
        "pattern": r"password\s*=\s*[\"']([^\"']{6,})[\"']",
        "severity": "CRITICAL",
        "description": "Hardcoded password found in source code.",
        "category": "Secrets",
    },
    {
        "name": "SQL Injection",
        "pattern": r"Statement\s*\.\s*executeQuery\s*\(\s*[\"'].*[\+\*]|query.*\+",
        "severity": "HIGH",
        "description": "Potential SQL injection via string concatenation.",
        "category": "Injection",
    },
    {
        "name": "Unsafe Deserialization",
        "pattern": r"ObjectInputStream|readObject|readResolve",
        "severity": "HIGH",
        "description": "Unsafe Java deserialization can lead to RCE.",
        "category": "Deserialization",
    },
    {
        "name": "Weak Cryptography",
        "pattern": r"MessageDigest\s*\.\s*getInstance\s*\(\s*[\"'](MD5|SHA1)[\"']",
        "severity": "HIGH",
        "description": "Weak hashing algorithm detected.",
        "category": "Cryptography",
    },
    {
        "name": "Path Traversal",
        "pattern": r"new\s+File\s*\(\s*.*\s*\+|getResource\s*\(|toPath",
        "severity": "HIGH",
        "description": "Potential path traversal vulnerability.",
        "category": "Path Traversal",
    },
    {
        "name": "Hardcoded API Key",
        "pattern": r"apiKey\s*=\s*[\"']([a-zA-Z0-9\-_]{20,})[\"']",
        "severity": "CRITICAL",
        "description": "Hardcoded API key detected in source.",
        "category": "Secrets",
    },
    {
        "name": "Insecure Random",
        "pattern": r"new\s+Random\s*\(\|Math\.random\(\)|Random\s*\(",
        "severity": "MEDIUM",
        "description": "Weak random number generation — use SecureRandom.",
        "category": "Cryptography",
    },
    {
        "name": "XXE Vulnerability",
        "pattern": r"SAXParser|XMLFactory|DocumentBuilderFactory|XMLReader",
        "severity": "HIGH",
        "description": "Potential XML External Entity (XXE) vulnerability.",
        "category": "Injection",
    },
    {
        "name": "Reflection Abuse",
        "pattern": r"forName|getMethod|invoke|newInstance",
        "severity": "MEDIUM",
        "description": "Reflection used — potential for code injection.",
        "category": "Code Quality",
    },
]
