"""
Rules package
Automatically loads all language-specific security rules
"""

from . import general_rules, python_rules, js_rules, java_rules, go_rules
from . import rust_rules, php_rules, ruby_rules, cpp_rules, kotlin_rules
from . import swift_rules, dart_rules, csharp_rules, shell_rules

# Aggregate all rules by language
RULES_BY_LANGUAGE = {
    "general": general_rules.RULES,
    "python": python_rules.RULES,
    "javascript": js_rules.RULES,
    "typescript": js_rules.RULES,  # TypeScript uses same rules as JS
    "java": java_rules.RULES,
    "go": go_rules.RULES,
    "rust": rust_rules.RULES,
    "php": php_rules.RULES,
    "ruby": ruby_rules.RULES,
    "c": cpp_rules.RULES,
    "cpp": cpp_rules.RULES,
    "csharp": csharp_rules.RULES,
    "dotnet": csharp_rules.RULES,
    "kotlin": kotlin_rules.RULES,
    "swift": swift_rules.RULES,
    "dart": dart_rules.RULES,
    "shell": shell_rules.RULES,
    "bash": shell_rules.RULES,
}

def get_rules_for_language(language: str):
    """Get security rules for a specific language"""
    return RULES_BY_LANGUAGE.get(language.lower(), general_rules.RULES)

def get_all_rules():
    """Get all rules from all languages"""
    all_rules = []
    for rules in RULES_BY_LANGUAGE.values():
        all_rules.extend(rules)
    return all_rules
