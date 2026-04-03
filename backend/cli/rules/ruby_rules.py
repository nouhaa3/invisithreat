"""
Ruby vulnerability detection rules
"""

RULES = [
    {
        "name": "SQL Injection",
        "pattern": r"find_by|where\s*\(['\"].*#\{|execute\s*['\"].*#\{",
        "severity": "HIGH",
        "description": "SQL query with string interpolation.",
        "category": "Injection",
    },
    {
        "name": "Command Injection",
        "pattern": r"system|%x|\`.*#{|shell_escape|backtick",
        "severity": "CRITICAL",
        "description": "User input passed to system command.",
        "category": "Code Execution",
    },
    {
        "name": "Hardcoded Secret",
        "pattern": r"password\s*=\s*['\"]([^'\"]{6,})['\"]|secret_key|api_key\s*=",
        "severity": "CRITICAL",
        "description": "Hardcoded password or API key.",
        "category": "Secrets",
    },
    {
        "name": "Weak Cryptography",
        "pattern": r"Digest::MD5|Digest::SHA1|md5|sha1",
        "severity": "HIGH",
        "description": "Weak hashing algorithm.",
        "category": "Cryptography",
    },
    {
        "name": "XSS via ERB",
        "pattern": r"<%=\s*[^\\|]*%>|h\(\s*\)|raw\(|html_safe",
        "severity": "HIGH",
        "description": "Unescaped output in ERB template.",
        "category": "XSS",
    },
    {
        "name": "Mass Assignment",
        "pattern": r"attr_accessor|permit\s*\(\s*:all|update\s*\(params",
        "severity": "MEDIUM",
        "description": "Potential mass assignment vulnerability.",
        "category": "Code Quality",
    },
    {
        "name": "Code Eval",
        "pattern": r"eval\s*\(|instance_eval|class_eval",
        "severity": "CRITICAL",
        "description": "Dynamic code evaluation detected.",
        "category": "Code Execution",
    },
    {
        "name": "Reflection Metaprogramming",
        "pattern": r"method\(|send|__send__|define_method",
        "severity": "MEDIUM",
        "description": "Reflection or metaprogramming could enable injection.",
        "category": "Code Quality",
    },
    {
        "name": "XXE Vulnerability",
        "pattern": r"Nokogiri\.parse|REXML::Document\.new",
        "severity": "HIGH",
        "description": "Potential XML External Entity (XXE) vulnerability.",
        "category": "Injection",
    },
]
