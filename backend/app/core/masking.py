import re


def mask_secret(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip()
    if len(value) <= 6:
        return "*" * len(value)
    return f"{value[:5]}{'*' * min(8, len(value) - 5)}"


def redact_text(value: str | None) -> str | None:
    if not value:
        return value
    text = value
    text = re.sub(r"(ghp_[A-Za-z0-9]{20,})", "ghp_****", text)
    text = re.sub(r"(github_pat_[A-Za-z0-9_]{20,})", "github_pat_****", text)
    text = re.sub(r"(sk-[A-Za-z0-9]{10,})", "sk-****", text)
    return text
