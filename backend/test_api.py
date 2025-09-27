#!/usr/bin/env python3
"""
Simple test script for FastAPI backend
"""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test imports
try:
    from config.settings import settings

    print("✅ Config import successful")
    print(f"   Database path: {settings.db_path}")
    print(f"   Port: {settings.port}")
except Exception as e:
    print(f"❌ Config import failed: {e}")
    sys.exit(1)

try:
    from database.connection import DatabaseManager

    print("✅ Database import successful")
except Exception as e:
    print(f"❌ Database import failed: {e}")
    sys.exit(1)

try:
    from auth.authentication import parse_htpasswd

    print("✅ Auth import successful")
except Exception as e:
    print(f"❌ Auth import failed: {e}")
    sys.exit(1)

try:
    from routers import imports, test_runs, time_series, utils_router

    print("✅ Router imports successful")
except Exception as e:
    print(f"❌ Router imports failed: {e}")
    sys.exit(1)

try:
    from main import app

    print("✅ Main app import successful")
except Exception as e:
    print(f"❌ Main app import failed: {e}")
    sys.exit(1)

print("\n🎉 All imports successful! FastAPI migration appears to be working.")
print("\nTo run the server:")
print("  python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000")
print("\nAPI Documentation will be available at:")
print("  http://localhost:8000/docs")
print("  http://localhost:8000/redoc")
