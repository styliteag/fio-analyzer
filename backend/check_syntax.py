#!/usr/bin/env python3
"""
Check syntax of Python files without running them
"""

import ast
import sys
from pathlib import Path


def check_syntax(file_path):
    """Check if a Python file has valid syntax"""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        ast.parse(content)
        return True, None
    except SyntaxError as e:
        return False, f"Syntax error: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def main():
    """Check syntax of all Python files"""
    backend_dir = Path(__file__).parent
    python_files = list(backend_dir.rglob("*.py"))

    print("Checking syntax of Python files...")

    errors = []
    for file_path in python_files:
        if file_path.name == "__pycache__":
            continue

        relative_path = file_path.relative_to(backend_dir)
        is_valid, error = check_syntax(file_path)

        if is_valid:
            print(f"✅ {relative_path}")
        else:
            print(f"❌ {relative_path}: {error}")
            errors.append((relative_path, error))

    if errors:
        print(f"\n❌ Found {len(errors)} syntax errors:")
        for file_path, error in errors:
            print(f"  {file_path}: {error}")
        sys.exit(1)
    else:
        print(f"\n🎉 All {len(python_files)} Python files have valid syntax!")


if __name__ == "__main__":
    main()
