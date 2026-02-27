"""
General / multi-language vulnerability detection rules
(applies to any text file)
"""

GENERAL_RULES = [
    {
        "id": "GEN001",
        "name": "Hardcoded AWS Key",
        "severity": "CRITICAL",
        "pattern": r"AKIA[0-9A-Z]{16}",
        "description": "AWS Access Key ID found in source.",
        "category": "Secrets",
        "fix": "Revoke this key immediately and use IAM roles or environment variables.",
    },
    {
        "id": "GEN002",
        "name": "Hardcoded Private Key Block",
        "severity": "CRITICAL",
        "pattern": r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
        "description": "Private key embedded in source code.",
        "category": "Secrets",
        "fix": "Remove the key, rotate it, and store it in a secrets manager.",
    },
    {
        "id": "GEN003",
        "name": "Generic Hardcoded Secret",
        "severity": "HIGH",
        "pattern": r"(SECRET_KEY|JWT_SECRET|DB_PASSWORD|DATABASE_URL)\s*=\s*[\"'][^\"']{6,}[\"']",
        "description": "Sensitive configuration value hardcoded in source.",
        "category": "Secrets",
        "fix": "Move to environment variables (.env file, never commit).",
    },
    {
        "id": "GEN004",
        "name": "TODO / FIXME Security Note",
        "severity": "INFO",
        "pattern": r"(TODO|FIXME|HACK|XXX)\s*:?\s*.*(security|auth|password|vuln|sql|inject|xss)",
        "description": "Security-related TODO/FIXME comment found.",
        "category": "Code Quality",
        "fix": "Address this security concern before production deployment.",
    },
    {
        "id": "GEN005",
        "name": "IP Address Hardcoded",
        "severity": "LOW",
        "pattern": r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b",
        "description": "Hardcoded IP address found.",
        "category": "Configuration",
        "fix": "Use hostnames or environment variables for IP configuration.",
    },
    {
        "id": "GEN006",
        "name": "Possible Base64 Encoded Secret",
        "severity": "MEDIUM",
        "pattern": r"[\"'][A-Za-z0-9+/]{40,}={0,2}[\"']",
        "description": "Long base64-encoded string — may be an encoded secret.",
        "category": "Secrets",
        "fix": "Verify this is not an encoded credential. Move secrets to vault.",
    },
]
