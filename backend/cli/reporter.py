"""
Console reporter - rich colored output for scan results
"""
import sys
from cli.scanner import ScanResult, Finding

# ANSI colors
RESET  = "\033[0m"
BOLD   = "\033[1m"
DIM    = "\033[2m"

RED    = "\033[91m"
ORANGE = "\033[33m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
GRAY   = "\033[90m"
WHITE  = "\033[97m"

SEVERITY_STYLE = {
    "CRITICAL": (RED,    "██ CRITICAL"),
    "HIGH":     (ORANGE, "▲  HIGH    "),
    "MEDIUM":   (YELLOW, "◆  MEDIUM  "),
    "LOW":      (BLUE,   "●  LOW     "),
    "INFO":     (GRAY,   "ℹ  INFO    "),
}

SEVERITY_BADGE = {
    "CRITICAL": f"{RED}{BOLD} CRITICAL {RESET}",
    "HIGH":     f"{ORANGE}{BOLD}   HIGH   {RESET}",
    "MEDIUM":   f"{YELLOW}{BOLD}  MEDIUM  {RESET}",
    "LOW":      f"{BLUE}{BOLD}    LOW   {RESET}",
    "INFO":     f"{GRAY}{BOLD}   INFO   {RESET}",
}


def _line(char="─", width=72):
    return GRAY + char * width + RESET


def _header():
    print()
    print(f"{BOLD}{ORANGE}  ╔══════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{ORANGE}  ║     InvisiThreat CLI Scanner  │  Security Audit v0.1    ║{RESET}")
    print(f"{BOLD}{ORANGE}  ╚══════════════════════════════════════════════════════════╝{RESET}")
    print()


def _summary_bar(counts: dict):
    parts = []
    for sev, (color, _) in SEVERITY_STYLE.items():
        n = counts.get(sev, 0)
        if n:
            parts.append(f"{color}{BOLD}{n} {sev}{RESET}")
    return "  ".join(parts) if parts else f"{GREEN}No vulnerabilities found{RESET}"


def print_report(result: ScanResult, verbose: bool = False):
    _header()

    # ── Scan info ──────────────────────────────────────────────────
    print(f"  {BOLD}Target :{RESET}  {CYAN}{result.target}{RESET}")
    print(f"  {BOLD}Scanned:{RESET}  {result.scanned} files   {GRAY}({result.skipped} skipped){RESET}")
    print(f"  {BOLD}Found  :{RESET}  {len(result.findings)} issues")
    if result.errors:
        print(f"  {BOLD}Errors :{RESET}  {ORANGE}{len(result.errors)}{RESET}")
    print()
    print(_line())

    if not result.findings:
        print(f"\n  {GREEN}{BOLD}✔  No vulnerabilities detected.{RESET}\n")
        return

    # ── Findings ───────────────────────────────────────────────────
    current_severity = None
    for finding in result.findings:
        if finding.severity != current_severity:
            current_severity = finding.severity
            color, label = SEVERITY_STYLE[finding.severity]
            print()
            print(f"  {color}{BOLD}{'━'*68}{RESET}")
            print(f"  {color}{BOLD}  {label}  ({result.counts[finding.severity]} issues){RESET}")
            print(f"  {color}{BOLD}{'━'*68}{RESET}")

        color, _ = SEVERITY_STYLE[finding.severity]

        print()
        print(f"  {BOLD}{WHITE}[{finding.rule_id}] {finding.name}{RESET}")
        print(f"  {GRAY}Category : {finding.category}{RESET}")
        print(f"  {GRAY}File     : {CYAN}{finding.file}{RESET}{GRAY}  line {finding.line}{RESET}")
        print(f"  {GRAY}Code     : {DIM}{finding.code}{RESET}")
        print(f"  {GRAY}Issue    : {finding.description}{RESET}")
        print(f"  {GREEN}Fix      : {finding.fix}{RESET}")

    print()
    print(_line("═"))

    # ── Summary ────────────────────────────────────────────────────
    print()
    print(f"  {BOLD}SCAN SUMMARY{RESET}")
    print()
    counts = result.counts

    total = len(result.findings)
    for sev, (color, label) in SEVERITY_STYLE.items():
        n = counts.get(sev, 0)
        bar = color + ("█" * min(n, 40)) + RESET
        pct = f"{n/total*100:.0f}%" if total else "0%"
        print(f"  {color}{label}{RESET}  {bar}  {BOLD}{n:>3}{RESET} {GRAY}({pct}){RESET}")

    print()
    print(f"  {_summary_bar(counts)}")
    print()

    # ── Risk rating ────────────────────────────────────────────────
    critical = counts.get("CRITICAL", 0)
    high     = counts.get("HIGH", 0)
    if critical > 0:
        risk = f"{RED}{BOLD}🔴  CRITICAL RISK — Immediate action required{RESET}"
    elif high > 0:
        risk = f"{ORANGE}{BOLD}🟠  HIGH RISK — Address before next release{RESET}"
    elif counts.get("MEDIUM", 0) > 0:
        risk = f"{YELLOW}{BOLD}🟡  MEDIUM RISK — Schedule fixes soon{RESET}"
    else:
        risk = f"{GREEN}{BOLD}🟢  LOW RISK — Good security posture{RESET}"

    print(f"  Overall Risk:  {risk}")
    print()
    print(_line("═"))
    print()


def print_errors(result: ScanResult):
    if result.errors:
        print(f"\n  {ORANGE}{BOLD}Scan errors ({len(result.errors)}):{RESET}")
        for e in result.errors:
            print(f"  {GRAY}• {e}{RESET}")
        print()
