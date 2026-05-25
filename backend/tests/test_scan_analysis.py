from app.services.scan_analysis import (
    filter_findings,
    finding_kind,
    normalize_analysis_type,
    should_run_dependencies,
    should_run_dast,
    should_run_sast,
    should_run_secrets,
)


def test_normalize_analysis_type_aliases():
    assert normalize_analysis_type("full") == "Full"
    assert normalize_analysis_type("SECRETS") == "Secrets"
    assert normalize_analysis_type("Full (SAST + Secrets + Dependencies)") == "Full"


def test_finding_kind_classification():
    assert finding_kind({"category": "dependency"}) == "dependency"
    assert finding_kind({"category": "hardcoded_secret", "rule_id": "X"}) == "secret"
    assert finding_kind({"category": "sast", "rule_id": "SQL001"}) == "sast"
    assert finding_kind({"category": "dast"}) == "dast"


def test_filter_findings_by_analysis_type():
    findings = [
        {"category": "sast", "rule_id": "SQL001"},
        {"category": "hardcoded_secret", "rule_id": "SEC001"},
        {"category": "dependency", "rule_id": "OSV-1"},
        {"category": "dast", "rule_id": "DAST_1"},
    ]
    assert len(filter_findings(findings, "SAST")) == 1
    assert len(filter_findings(findings, "Secrets")) == 1
    assert len(filter_findings(findings, "Dependencies")) == 1
    assert len(filter_findings(findings, "Full")) == 4


def test_should_run_flags():
    assert should_run_sast("Full")
    assert should_run_secrets("Full")
    assert should_run_dependencies("Full")
    assert should_run_dast("Full", "https://example.com")
    assert not should_run_dast("SAST", "https://example.com")
    assert not should_run_dependencies("SAST")
