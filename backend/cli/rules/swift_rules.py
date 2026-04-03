"""
Swift vulnerability detection rules
"""

RULES = [
    {
        "name": "Hardcoded Secret",
        "pattern": r"let\s+\w+\s*=\s*[\"']([a-zA-Z0-9\-_]{20,})[\"']|password\s*=\s*[\"']",
        "severity": "CRITICAL",
        "description": "Hardcoded credential.",
        "category": "Secrets",
    },
    {
        "name": "SQL Injection",
        "pattern": r"FMDatabase|execute.*\+|query.*\+|SELECT.*String\(|String\(.*SELECT",
        "severity": "HIGH",
        "description": "SQL query built with string concatenation.",
        "category": "Injection",
    },
    {
        "name": "Weak Crypto",
        "pattern": r"MD5|SHA1|Digest|CryptoKit.*MD5",
        "severity": "HIGH",
        "description": "Weak cryptographic algorithm.",
        "category": "Cryptography",
    },
    {
        "name": "Insecure Communication",
        "pattern": r"http://|allowsArbitraryLoads|NSAllowsArbitraryLoads",
        "severity": "HIGH",
        "description": "Insecure HTTP or arbitrary load.",
        "category": "Cryptography",
    },
    {
        "name": "Log Sensitive Data",
        "pattern": r"print\(|NSLog|os\.log.*password|debugPrint.*secret",
        "severity": "MEDIUM",
        "description": "Sensitive data logged.",
        "category": "Information Disclosure",
    },
    {
        "name": "Hardcoded URL",
        "pattern": r"let\s+\w*url\s*=\s*[\"']https?://",
        "severity": "MEDIUM",
        "description": "Hardcoded URL in code.",
        "category": "Configuration",
    },
    {
        "name": "Force Unwrapping",
        "pattern": r"!|guard.*else|if let.*else",
        "severity": "MEDIUM",
        "description": "Unsafe force unwrapping of optional types.",
        "category": "Code Quality",
    },
    {
        "name": "Memory Management",
        "pattern": r"unowned|weak|@autoreleasepool|deinit",
        "severity": "MEDIUM",
        "description": "Complex memory management with potential leaks.",
        "category": "Memory Safety",
    },
    {
        "name": "XXE Vulnerability",
        "pattern": r"XMLParser|XMLDocument|parseXML",
        "severity": "HIGH",
        "description": "Potential XML External Entity vulnerability.",
        "category": "Injection",
    },
]
