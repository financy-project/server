#!/usr/bin/env python3
"""
Write Test skill.

Ensures test files are located next to source files and have proper structure.
"""

import os
import json
import sys
import re
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict


def run_git(*args) -> Tuple[str, int]:
    """Run git command and return output + exit code."""
    try:
        result = subprocess.run(
            ["git"] + list(args),
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout.strip(), result.returncode
    except Exception as e:
        return str(e), 1


def get_source_files(package: str = None) -> List[str]:
    """Get all source files in the repo (excluding tests)."""
    output, _ = run_git("ls-files")
    files = output.split("\n") if output else []

    source_files = []
    for file in files:
        if not file:
            continue

        if ".test." in file:
            continue

        if not (file.endswith(".ts") or file.endswith(".tsx") or file.endswith(".py")):
            continue

        if any(skip in file for skip in [
            "node_modules", "dist", "build", ".next", "__pycache__", "generated"
        ]):
            continue

        if package:
            if not file.startswith(f"{package}/"):
                continue

        source_files.append(file)

    return sorted(source_files)


def find_or_create_test_file(source_file: str) -> Tuple[str, bool]:
    """
    Find or suggest test file location for a source file.

    Returns: (test_file_path, exists)
    """
    source_path = Path(source_file)
    stem = source_path.stem
    ext = source_path.suffix

    test_candidates = [
        source_path.parent / "__tests__" / f"{stem}.test{ext}",
        source_path.parent / f"{stem}.test{ext}",
    ]

    for candidate in test_candidates:
        if candidate.exists():
            return str(candidate), True

    return str(test_candidates[0]), False


def has_describe_block(test_file: str) -> bool:
    """Check if test file has a describe block."""
    if not Path(test_file).exists():
        return False

    with open(test_file) as f:
        content = f.read()

    pattern = r"^\s*describe\s*\(\s*['\"].*?['\"]"
    matches = re.findall(pattern, content, re.MULTILINE)
    return len(matches) > 0


def get_describe_name(source_file: str) -> str:
    """Extract describe block name from source file."""
    source_path = Path(source_file)
    stem = source_path.stem

    parts = stem.split("-")
    name_parts = []

    for part in parts:
        subparts = part.split(".")
        for subpart in subparts:
            if subpart:
                name_parts.append(subpart.capitalize())

    return "".join(name_parts)


def generate_test_template(source_file: str, test_file: str) -> str:
    """Generate test file template."""
    describe_name = get_describe_name(source_file)

    is_typescript = source_file.endswith(".ts") or source_file.endswith(".tsx")

    if is_typescript:
        template = f'''import {{ describe, it, expect }} from '@jest/globals'
import {{ {describe_name} }} from '../{Path(source_file).stem}'

describe('{describe_name}', () => {{
  it('should be defined', () => {{
    expect({describe_name}).toBeDefined()
  }})

  // TODO: Add test cases
}})
'''
    else:
        template = f"# TODO: Add tests for {source_file}\n"

    return template


def analyze_file(source_file: str) -> Dict:
    """Analyze a source file for test organization."""
    test_file, test_exists = find_or_create_test_file(source_file)

    has_describe = has_describe_block(test_file) if test_exists else False

    return {
        "source": source_file,
        "test": test_file,
        "test_exists": test_exists,
        "has_describe": has_describe,
        "status": _get_status(test_exists, has_describe),
    }


def _get_status(test_exists: bool, has_describe: bool) -> str:
    """Determine status of test organization."""
    if not test_exists:
        return "MISSING"
    elif not has_describe:
        return "NO_DESCRIBE"
    else:
        return "OK"


def main():
    """Main execution."""
    try:
        workspace_root = os.environ.get("WORKSPACE_ROOT", ".")
        package_name = os.environ.get("PACKAGE_NAME")

        os.chdir(workspace_root)

        source_files = get_source_files(package=package_name)

        if not source_files:
            return json.dumps({
                "status": "error",
                "error_code": 2,
                "message": "No source files found"
            })

        results = []
        stats = {"ok": 0, "missing": 0, "no_describe": 0}

        for source_file in source_files:
            analysis = analyze_file(source_file)
            results.append(analysis)

            status = analysis["status"]
            if status == "OK":
                stats["ok"] += 1
            elif status == "MISSING":
                stats["missing"] += 1
            elif status == "NO_DESCRIBE":
                stats["no_describe"] += 1

        issues = [r for r in results if r["status"] != "OK"]

        remediation = []
        for issue in issues:
            if issue["status"] == "MISSING":
                template = generate_test_template(issue["source"], issue["test"])
                remediation.append({
                    "file": issue["source"],
                    "action": "CREATE_TEST",
                    "test_file": issue["test"],
                    "template": template,
                })
            elif issue["status"] == "NO_DESCRIBE":
                remediation.append({
                    "file": issue["source"],
                    "action": "ADD_DESCRIBE",
                    "test_file": issue["test"],
                    "describe_name": get_describe_name(issue["source"]),
                })

        exit_code = 0 if not issues else 1

        return json.dumps({
            "status": "success" if exit_code == 0 else "warning",
            "message": f"Analyzed {len(source_files)} files: {stats['ok']} OK, {stats['missing']} missing tests, {stats['no_describe']} without describe",
            "summary": {
                "total_files": len(source_files),
                "ok": stats["ok"],
                "missing_tests": stats["missing"],
                "missing_describe": stats["no_describe"],
            },
            "remediation": remediation[:5],
            "remediation_count": len(remediation),
        })

    except Exception as e:
        return json.dumps({
            "status": "error",
            "error_code": 3,
            "message": str(e)
        })


if __name__ == "__main__":
    result = main()
    print(result)
    sys.exit(0)
