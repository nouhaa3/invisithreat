#!/usr/bin/env python3
"""
InvisiThreat CLI Scanner — Entry point

Usage:
    python -m cli.main <path> [options]

Options:
    --verbose   Show all findings including INFO
    --output    Output format: console (default) | json

Examples:
    python -m cli.main ./myproject
    python -m cli.main ./myproject --verbose
    python -m cli.main ./backend --output json
"""
import sys
import argparse
import json
import os

# Allow running from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from cli.scanner import scan
from cli.reporter import print_report, print_errors
from cli.scanner import SEVERITY_ORDER


def parse_args():
    parser = argparse.ArgumentParser(
        prog="invisithreat-scan",
        description="InvisiThreat CLI Scanner — Static security analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("target", help="Path to file or directory to scan")
    parser.add_argument("--verbose", action="store_true", help="Include INFO-level findings")
    parser.add_argument("--output", choices=["console", "json"], default="console",
                        help="Output format (default: console)")
    parser.add_argument("--min-severity", choices=["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"],
                        default="INFO", help="Minimum severity to report")
    return parser.parse_args()


def main():
    args = parse_args()

    # Run scan
    result = scan(args.target)

    # Filter by min severity
    min_level = SEVERITY_ORDER[args.min_severity]
    result.findings = [
        f for f in result.findings
        if SEVERITY_ORDER.get(f.severity, 9) <= min_level
    ]

    # Output
    if args.output == "json":
        data = {
            "target": result.target,
            "scanned": result.scanned,
            "skipped": result.skipped,
            "total_findings": len(result.findings),
            "summary": result.counts,
            "findings": [
                {
                    "rule_id":     f.rule_id,
                    "name":        f.name,
                    "severity":    f.severity,
                    "category":    f.category,
                    "description": f.description,
                    "fix":         f.fix,
                    "file":        f.file,
                    "line":        f.line,
                    "code":        f.code,
                }
                for f in result.findings
            ],
            "errors": result.errors,
        }
        print(json.dumps(data, indent=2))
    else:
        print_report(result, verbose=args.verbose)
        print_errors(result)

    # Exit code — non-zero if CRITICAL or HIGH found
    counts = result.counts
    if counts.get("CRITICAL", 0) > 0:
        sys.exit(2)
    elif counts.get("HIGH", 0) > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
