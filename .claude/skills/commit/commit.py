#!/usr/bin/env python3
"""
Semantic & atomic commit skill.

Groups source files with their tests and creates atomic commits.
"""

import json
import sys
import subprocess
from pathlib import Path
from typing import List, Tuple

COMMIT_TYPES = [
    "feat",      # New feature
    "fix",       # Bug fix
    "test",      # Adding tests
    "refactor",  # Code refactoring
    "docs",      # Documentation
    "chore",     # Maintenance
    "perf",      # Performance improvement
    "style",     # Code style (formatting, etc)
]


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


def get_changed_files() -> List[str]:
    """Get list of changed files (staged + unstaged)."""
    staged_output, _ = run_git("diff", "--name-only", "--cached")
    unstaged_output, _ = run_git("diff", "--name-only")

    staged = set(staged_output.split("\n")) if staged_output else set()
    unstaged = set(unstaged_output.split("\n")) if unstaged_output else set()

    files = list((staged | unstaged) - {""})
    return sorted(files)


def find_test_file(source_file: str) -> str:
    """
    Find test file for a source file.

    Patterns:
    - src/foo.ts → src/__tests__/foo.test.ts
    - src/foo.ts → src/foo.test.ts
    - src/modules/transaction/use-cases/create.use-case.ts →
      src/modules/transaction/__tests__/unit/use-cases/create-describe.test.ts
    """
    source_path = Path(source_file)

    if source_file.endswith(".test.ts") or source_file.endswith(".test.py"):
        return None

    if not (source_file.endswith(".ts") or source_file.endswith(".py") or
            source_file.endswith(".tsx") or source_file.endswith(".jsx")):
        return None

    stem = source_path.stem
    ext = source_path.suffix

    candidates = [
        source_path.parent / "__tests__" / f"{stem}.test{ext}",
        source_path.parent / f"{stem}.test{ext}",
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    return None


def group_files_with_tests(files: List[str]) -> List[List[str]]:
    """
    Group source files with their tests.

    Returns list of file groups: [[source.ts, source.test.ts], [other.ts], ...]
    """
    file_set = set(files)
    grouped = []
    processed = set()

    for file in files:
        if file in processed:
            continue

        if file.endswith(".test.ts") or file.endswith(".test.py") or \
           file.endswith(".test.tsx") or file.endswith(".test.jsx"):
            if file not in processed:
                grouped.append([file])
                processed.add(file)
            continue

        test_file = find_test_file(file)

        if test_file and test_file in file_set:
            grouped.append([file, test_file])
            processed.add(file)
            processed.add(test_file)
        else:
            grouped.append([file])
            processed.add(file)

    return grouped


def extract_scope(files: List[str]) -> str:
    """
    Extract scope (module name) from file paths.

    Examples:
    - src/modules/transaction/use-cases/create.use-case.ts → transaction
    - src/shared/utils/uuid.ts → shared
    - src/services/hash.service.ts → services
    """
    if not files:
        return ""

    file = files[0]
    parts = file.split("/")

    if "modules" in parts:
        idx = parts.index("modules")
        if idx + 1 < len(parts):
            return parts[idx + 1]

    if "src" in parts:
        idx = parts.index("src")
        if idx + 1 < len(parts):
            return parts[idx + 1]

    return ""


def prompt_for_commit_type() -> str:
    """Prompt user for commit type."""
    print("\nCommit type options:")
    for i, ctype in enumerate(COMMIT_TYPES, 1):
        print(f"  {i}. {ctype}")

    while True:
        choice = input("\nSelect commit type (1-8 or type name): ").strip()

        if choice.isdigit() and 1 <= int(choice) <= len(COMMIT_TYPES):
            return COMMIT_TYPES[int(choice) - 1]
        elif choice in COMMIT_TYPES:
            return choice
        else:
            print("Invalid choice. Try again.")


def prompt_for_subject(ctype: str, scope: str) -> str:
    """Prompt user for commit subject."""
    default = f"{ctype}({scope})" if scope else ctype
    subject = input(f"\nCommit subject [{default}]: ").strip()
    return subject or default


def stage_files(files: List[str]) -> bool:
    """Stage files for commit."""
    for file in files:
        _, code = run_git("add", file)
        if code != 0:
            print(f"ERROR: Could not stage {file}", file=sys.stderr)
            return False
    return True


def commit_files(files: List[str], subject: str) -> bool:
    """Create a commit for the given files."""
    if not stage_files(files):
        return False

    message = subject

    if len(files) > 2:
        message += "\n\nModified files:\n"
        for file in files:
            message += f"- {file}\n"

    _, code = run_git("commit", "-m", message, "--no-gpg-sign")
    return code == 0


def main():
    """Main execution."""
    try:
        changed_files = get_changed_files()

        if not changed_files:
            return json.dumps({
                "status": "error",
                "error_code": 2,
                "message": "No changes to commit"
            })

        print(f"Found {len(changed_files)} changed files")

        file_groups = group_files_with_tests(changed_files)
        committed_groups = 0

        for i, group in enumerate(file_groups, 1):
            print(f"\n--- Group {i}/{len(file_groups)} ---")
            print("Files:")
            for file in group:
                print(f"  - {file}")

            ctype = prompt_for_commit_type()
            scope = extract_scope(group)
            subject = prompt_for_subject(ctype, scope)

            if commit_files(group, subject):
                print(f"✓ Committed: {subject}")
                committed_groups += 1
            else:
                print(f"✗ Failed to commit group {i}")

        if committed_groups == 0:
            return json.dumps({
                "status": "error",
                "error_code": 1,
                "message": "Failed to create any commits"
            })

        return json.dumps({
            "status": "success",
            "message": f"Created {committed_groups} atomic commits",
            "artifacts": [
                {
                    "path": ".git",
                    "type": "directory",
                    "description": f"{committed_groups} new commits added"
                }
            ]
        })

    except KeyboardInterrupt:
        return json.dumps({
            "status": "error",
            "error_code": 3,
            "message": "User cancelled"
        })
    except Exception as e:
        return json.dumps({
            "status": "error",
            "error_code": 1,
            "message": str(e)
        })


if __name__ == "__main__":
    result = main()
    print(result)
    sys.exit(0 if json.loads(result)["status"] == "success" else 1)
