import logging
import re


SENSITIVE_PATTERNS = [
    re.compile(r"(ghp_[A-Za-z0-9]{20,})"),
    re.compile(r"(github_pat_[A-Za-z0-9_]{20,})"),
    re.compile(r"(sk-[A-Za-z0-9]{10,})"),
    re.compile(r"((?:access|refresh|api)?_?token\s*[:=]\s*)['\"]?([A-Za-z0-9\-._~+/]+=*)", re.IGNORECASE),
    re.compile(r"((?:password|passwd|secret|api_key)\s*[:=]\s*)['\"]?([^\s,'\"]+)", re.IGNORECASE),
]


def redact_log_text(value: str) -> str:
    text = value or ""
    for pattern in SENSITIVE_PATTERNS:
        text = pattern.sub(lambda m: (m.group(1) if m.lastindex and m.lastindex > 1 else "") + "***REDACTED***", text)
    return text


class RedactingLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = redact_log_text(str(record.msg))
            if record.args:
                record.args = tuple(redact_log_text(str(arg)) for arg in record.args)
        except Exception:
            return True
        return True
