#!/usr/bin/env python3
"""
Comprehensive linting and import validation script for the FIO Analyzer backend.
This script catches import errors, syntax issues, and code quality problems.
"""

import ast
import importlib.util
import sys
from typing import Dict, List, Set, Tuple


def check_imports(file_path: str) -> Tuple[bool, List[str]]:
    """Check if all imports in a file can be resolved"""
    errors = []

    try:
        with open(file_path, "r") as f:
            content = f.read()

        # Parse the AST to find imports
        tree = ast.parse(content)

        # Extract all imports
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    if alias.name == "*":
                        imports.append(module)
                    else:
                        imports.append(
                            f"{module}.{alias.name}" if module else alias.name
                        )

        # Check each import
        for imp in imports:
            try:
                # Try relative imports first (for local modules)
                if imp.startswith("."):
                    continue  # Skip relative imports for now

                # Check if it's a local module
                base_module = imp.split(".")[0]
                if base_module in ["auth", "database", "routers", "utils", "config"]:
                    # Local module - check if file exists
                    local_path = Path(base_module)
                    if not (
                        local_path.exists()
                        or (local_path.parent / f"{base_module}.py").exists()
                    ):
                        errors.append(f"Local module '{base_module}' not found")
                else:
                    # External module - try to import
                    spec = importlib.util.find_spec(base_module)
                    if spec is None:
                        errors.append(f"Module '{base_module}' not found")

            except Exception as e:
                errors.append(f"Error checking import '{imp}': {e}")

    except Exception as e:
        errors.append(f"Failed to parse file: {e}")

    return len(errors) == 0, errors


def check_syntax(file_path: str) -> Tuple[bool, List[str]]:
    """Check syntax of a Python file"""
    errors = []

    try:
        with open(file_path, "r") as f:
            content = f.read()

        # Compile to check syntax
        compile(content, file_path, "exec")

    except SyntaxError as e:
        errors.append(f"Syntax error at line {e.lineno}: {e.msg}")
    except Exception as e:
        errors.append(f"Error checking syntax: {e}")

    return len(errors) == 0, errors


def check_undefined_names(file_path: str) -> Tuple[bool, List[str]]:
    """Check for undefined names (like our Depends issue)"""
    errors = []

    try:
        with open(file_path, "r") as f:
            content = f.read()

        tree = ast.parse(content)

        # Collect all defined names
        defined_names = set()
        imported_names = set()

        for node in ast.walk(tree):
            # Function and class definitions
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                defined_names.add(node.name)

            # Variable assignments
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        defined_names.add(target.id)

            # Imports
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    name = alias.asname if alias.asname else alias.name
                    imported_names.add(name)

            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    name = alias.asname if alias.asname else alias.name
                    imported_names.add(name)

        # Check for undefined names in function calls and usage
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                name = node.id
                if (
                    name not in defined_names
                    and name not in imported_names
                    and name not in __builtins__
                    and not name.startswith("_")
                ):  # Skip private/magic names

                    # Common undefined names we should catch
                    if name in [
                        "Depends",
                        "Query",
                        "HTTPException",
                        "File",
                        "UploadFile",
                    ]:
                        errors.append(
                            f"Undefined name '{name}' - likely missing import"
                        )

    except Exception as e:
        errors.append(f"Error checking undefined names: {e}")

    return len(errors) == 0, errors


def lint_file(file_path: str) -> Dict[str, any]:
    """Run comprehensive lint checks on a file"""
    print(f"🔍 Linting {file_path}...")

    results = {
        "file": file_path,
        "syntax_ok": True,
        "imports_ok": True,
        "undefined_ok": True,
        "errors": [],
        "warnings": [],
    }

    # Check syntax
    syntax_ok, syntax_errors = check_syntax(file_path)
    results["syntax_ok"] = syntax_ok
    if syntax_errors:
        results["errors"].extend([f"SYNTAX: {e}" for e in syntax_errors])

    # Check imports (only if syntax is OK)
    if syntax_ok:
        imports_ok, import_errors = check_imports(file_path)
        results["imports_ok"] = imports_ok
        if import_errors:
            results["errors"].extend([f"IMPORT: {e}" for e in import_errors])

        # Check undefined names
        undefined_ok, undefined_errors = check_undefined_names(file_path)
        results["undefined_ok"] = undefined_ok
        if undefined_errors:
            results["errors"].extend([f"UNDEFINED: {e}" for e in undefined_errors])

    # Print results
    if results["syntax_ok"] and results["imports_ok"] and results["undefined_ok"]:
        print(f"  ✅ All checks passed")
    else:
        print(f"  ❌ Issues found:")
        for error in results["errors"]:
            print(f"    • {error}")

    return results


def main():
    """Main linting function"""
    print("🚀 FIO Analyzer Backend Linting Check")
    print("=" * 50)

    # Find all Python files
    python_files = []
    for root, dirs, files in os.walk("."):
        # Skip virtual environment and cache directories
        dirs[:] = [d for d in dirs if d not in ["venv", "__pycache__", ".git"]]
        for file in files:
            if file.endswith(".py"):
                python_files.append(os.path.join(root, file))

    # Lint each file
    all_results = []
    for file_path in sorted(python_files):
        result = lint_file(file_path)
        all_results.append(result)
        print()

    # Summary
    total_files = len(all_results)
    passed_files = len(
        [
            r
            for r in all_results
            if r["syntax_ok"] and r["imports_ok"] and r["undefined_ok"]
        ]
    )
    failed_files = total_files - passed_files

    print("=" * 50)
    print(f"📊 LINTING SUMMARY")
    print(f"Total files: {total_files}")
    print(f"Passed: {passed_files}")
    print(f"Failed: {failed_files}")

    if failed_files == 0:
        print("🎉 All files passed linting!")
        return 0
    else:
        print("❌ Some files have issues.")
        return 1


if __name__ == "__main__":
    exit(main())
