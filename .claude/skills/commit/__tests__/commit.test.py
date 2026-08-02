"""Tests for commit skill."""

import sys
from pathlib import Path

# Add skill to path
skill_dir = Path(__file__).parent.parent
sys.path.insert(0, str(skill_dir))

from commit import find_test_file, extract_scope


def test_find_test_file_skip_test_files():
    """Test that test files are skipped."""
    result = find_test_file("src/modules/transaction/resolvers/transaction.resolver.test.ts")
    assert result is None


def test_find_test_file_skip_non_source():
    """Test that non-source files are skipped."""
    result = find_test_file("README.md")
    assert result is None

    result = find_test_file("package.json")
    assert result is None


def test_extract_scope_from_modules():
    """Test scope extraction from src/modules path."""
    files = ["src/modules/transaction/resolvers/transaction.resolver.ts"]
    scope = extract_scope(files)
    assert scope == "transaction"


def test_extract_scope_from_shared():
    """Test scope extraction from src/shared."""
    files = ["src/shared/utils/uuid.ts"]
    scope = extract_scope(files)
    assert scope == "shared"


def test_extract_scope_from_services():
    """Test scope extraction from src/services."""
    files = ["src/services/hash.service.ts"]
    scope = extract_scope(files)
    assert scope == "services"


def test_extract_scope_no_src_prefix():
    """Test scope extraction falls back to empty string outside src/."""
    files = ["prisma/schema.prisma"]
    scope = extract_scope(files)
    assert scope == ""


if __name__ == "__main__":
    test_find_test_file_skip_test_files()
    test_find_test_file_skip_non_source()
    test_extract_scope_from_modules()
    test_extract_scope_from_shared()
    test_extract_scope_from_services()
    test_extract_scope_no_src_prefix()
    print("✓ All basic tests passed")
