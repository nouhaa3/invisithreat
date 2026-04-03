"""
Dart vulnerability detection rules
"""

RULES = [
    {
        "name": "Hardcoded Secret",
        "pattern": r"final\s+\w+\s*=\s*['\"]([a-zA-Z0-9\-_]{20,})['\"]|password\s*=\s*['\"]",
        "severity": "CRITICAL",
        "description": "Hardcoded credential or API key.",
        "category": "Secrets",
    },
    {
        "name": "SQL Injection",
        "pattern": r"query\(|execute.*\+|SELECT.*\+|rawQuery|['\"].*\\\$.*['\"]",
        "severity": "HIGH",
        "description": "SQL query with string interpolation.",
        "category": "Injection",
    },
    {
        "name": "Weak Crypto",
        "pattern": r"MD5|SHA1|md5|sha1|Hmac",
        "severity": "HIGH",
        "description": "Weak hashing or cryptography.",
        "category": "Cryptography",
    },
    {
        "name": "Insecure HTTP",
        "pattern": r"http://[^']|HttpClient|unsafeHttpClient",
        "severity": "HIGH",
        "description": "Insecure HTTP communication.",
        "category": "Cryptography",
    },
    {
        "name": "XSS in WebView",
        "pattern": r"WebViewChannel|enableJavaScript|allowsInlineMediaPlayback",
        "severity": "MEDIUM",
        "description": "WebView with potentially unsafe settings.",
        "category": "XSS",
    },
    {
        "name": "Sensitive Log",
        "pattern": r"print\(|log\(.*password|debugPrint.*secret|stdout\.writeln",
        "severity": "MEDIUM",
        "description": "Sensitive information logged.",
        "category": "Information Disclosure",
    },
    {
        "name": "Null Safety",
        "pattern": r"!|\\.|\\.\\.|null-coalescing",
        "severity": "MEDIUM",
        "description": "Unsafe null handling.",
        "category": "Code Quality",
    },
    {
        "name": "Async Error Handling",
        "pattern": r"async|await|Future|then|catchError",
        "severity": "MEDIUM",
        "description": "Async errors not properly handled.",
        "category": "Code Quality",
    },
    {
        "name": "XXE Vulnerability",
        "pattern": r"XmlDocument|xml\\.parse|parseDocument",
        "severity": "HIGH",
        "description": "Potential XML External Entity vulnerability.",
        "category": "Injection",
    },
]
