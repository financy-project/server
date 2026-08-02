"""Tests for write-test skill."""

import sys
from pathlib import Path

# Add skill to path
skill_dir = Path(__file__).parent.parent
sys.path.insert(0, str(skill_dir))

from write_test import (
    find_or_create_test_file,
    get_describe_name,
    generate_test_template,
)


def test_find_or_create_test_file_with_tests_dir():
    """Test finding test file in __tests__ directory."""
    test_file, exists = find_or_create_test_file("src/modules/transaction/transaction.resolver.ts")
    assert "__tests__" in test_file
    assert test_file.endswith("transaction.resolver.test.ts")


def test_find_or_create_test_file_same_dir():
    """Test finding test file in same directory."""
    test_file, exists = find_or_create_test_file("src/shared/utils/uuid.ts")
    assert "uuid.test.ts" in test_file


def test_get_describe_name_from_kebab_case():
    """Test converting kebab-case to PascalCase."""
    name = get_describe_name("create-transaction.use-case.ts")
    assert name == "CreateTransactionUseCase"


def test_get_describe_name_from_simple():
    """Test converting simple filename."""
    name = get_describe_name("transaction.ts")
    assert name == "Transaction"


def test_get_describe_name_with_dot():
    """Test filename with dots."""
    name = get_describe_name("transaction.mapper.ts")
    assert name == "TransactionMapper"


def test_generate_test_template_typescript():
    """Test TypeScript test template generation."""
    template = generate_test_template("src/shared/utils/uuid.ts", "src/shared/utils/__tests__/uuid.test.ts")
    assert "describe" in template
    assert "Uuid" in template
    assert "@jest/globals" in template


if __name__ == "__main__":
    test_find_or_create_test_file_with_tests_dir()
    test_find_or_create_test_file_same_dir()
    test_get_describe_name_from_kebab_case()
    test_get_describe_name_from_simple()
    test_get_describe_name_with_dot()
    test_generate_test_template_typescript()
    print("✓ All write-test skill tests passed")
