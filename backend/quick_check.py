#!/usr/bin/env python3
"""
Quick syntax and common import error checker for FastAPI files.
This catches issues like missing 'Depends' imports without needing virtual environment.
"""

import ast
import sys
from pathlib import Path


def check_fastapi_imports(file_path: str):
    """Check for common FastAPI import issues"""
    print(f"🔍 Checking {file_path}...")
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Parse AST
        tree = ast.parse(content)
        
        # Track imported names
        imported_names = set()
        imported_from_fastapi = set()
        
        # Collect imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    name = alias.asname if alias.asname else alias.name.split('.')[0]
                    imported_names.add(name)
            
            elif isinstance(node, ast.ImportFrom):
                if node.module == 'fastapi':
                    for alias in node.names:
                        name = alias.asname if alias.asname else alias.name
                        imported_from_fastapi.add(name)
                        imported_names.add(name)
                else:
                    for alias in node.names:
                        name = alias.asname if alias.asname else alias.name
                        imported_names.add(name)
        
        # Check for usage of common FastAPI components
        used_names = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                used_names.add(node.id)
        
        # Common FastAPI imports that are often missing
        common_fastapi = {
            'Depends', 'Query', 'Path', 'Body', 'Header', 'Cookie', 
            'File', 'UploadFile', 'Form', 'HTTPException', 'status'
        }
        
        # Check for missing imports
        missing_imports = []
        for name in common_fastapi:
            if name in used_names and name not in imported_names:
                missing_imports.append(name)
        
        # Check syntax
        try:
            compile(content, file_path, 'exec')
            syntax_ok = True
        except SyntaxError as e:
            syntax_ok = False
            print(f"  ❌ Syntax Error: Line {e.lineno}: {e.msg}")
            return False
        
        # Report results
        if syntax_ok and not missing_imports:
            print(f"  ✅ Syntax OK, all imports look good")
            return True
        else:
            if missing_imports:
                print(f"  ❌ Missing FastAPI imports: {missing_imports}")
                print(f"     Add to imports: from fastapi import {', '.join(missing_imports)}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error checking file: {e}")
        return False


def main():
    """Check key files for syntax and import issues"""
    print("🚀 Quick FastAPI Import & Syntax Check")
    print("=" * 45)
    
    # Key files to check
    key_files = [
        'main.py',
        'routers/imports.py',
        'routers/test_runs.py',
        'routers/time_series.py',
        'routers/utils_router.py',
        'auth/middleware.py'
    ]
    
    all_ok = True
    for file_path in key_files:
        if Path(file_path).exists():
            if not check_fastapi_imports(file_path):
                all_ok = False
        else:
            print(f"⚠️  File not found: {file_path}")
            all_ok = False
    
    print("=" * 45)
    if all_ok:
        print("🎉 All files pass quick checks!")
        print("✅ Ready to start the server")
    else:
        print("❌ Issues found - fix before starting server")
    
    return 0 if all_ok else 1


if __name__ == "__main__":
    exit(main())