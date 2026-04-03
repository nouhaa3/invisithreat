"""
C/C++ vulnerability detection rules
"""

RULES = [
    {
        "name": "Buffer Overflow",
        "pattern": r"strcpy|strcat|gets|sprintf|scanf|[^_]strcpy",
        "severity": "CRITICAL",
        "description": "Unsafe string function prone to buffer overflow.",
        "category": "Memory Safety",
    },
    {
        "name": "Hardcoded Credentials",
        "pattern": r"char\s+\*\s*password\s*=\s*[\"']|const\s+char\s+.*password",
        "severity": "CRITICAL",
        "description": "Hardcoded password in source.",
        "category": "Secrets",
    },
    {
        "name": "SQL Injection",
        "pattern": r"sprintf.*SELECT|strcat.*SELECT|query.*sprintf",
        "severity": "HIGH",
        "description": "SQL query built with string operations.",
        "category": "Injection",
    },
    {
        "name": "Format String",
        "pattern": r"printf\s*\([^\"]*%|fprintf\s*\([^,]*,[^\"]*%|sprintf.*%",
        "severity": "HIGH",
        "description": "Potential format string vulnerability.",
        "category": "Code Execution",
    },
    {
        "name": "Use After Free",
        "pattern": r"free\s*\(|delete\s+|delete\s*\[\s*\]",
        "severity": "HIGH",
        "description": "Potential use-after-free vulnerability.",
        "category": "Memory Safety",
    },
    {
        "name": "Weak Crypto",
        "pattern": r"MD5|SHA1|md5|sha1|crypt",
        "severity": "HIGH",
        "description": "Weak cryptographic function.",
        "category": "Cryptography",
    },
    {
        "name": "Integer Overflow",
        "pattern": r"size_t|int\s*\+\s*int|unsigned|overflow",
        "severity": "MEDIUM",
        "description": "Integer overflow/underflow risk.",
        "category": "Memory Safety",
    },
    {
        "name": "Unchecked Function Return",
        "pattern": r"malloc|calloc|realloc|fopen|recv",
        "severity": "MEDIUM",
        "description": "Return value not checked (could be NULL).",
        "category": "Error Handling",
    },
    {
        "name": "XXE/XML Parsing",
        "pattern": r"libxml2|xml2-config|xmlParseFile",
        "severity": "HIGH",
        "description": "XXE vulnerability in XML parsing.",
        "category": "Injection",
    },
]
