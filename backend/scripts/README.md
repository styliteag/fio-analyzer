# FIO Analyzer Backend Scripts

This directory contains management scripts for the FIO Analyzer FastAPI backend.

## 🐍 Python Backend Scripts

The backend has been migrated to Python FastAPI. All scripts are now Python-based and require the virtual environment to be activated.

## 📋 Prerequisites

Before running any scripts, ensure the Python virtual environment is activated:

```bash
cd backend
source venv/bin/activate  # Activate virtual environment
```

## 🔧 Available Scripts

### Code Quality & Development Tools

Before running scripts or making changes, ensure code quality:

```bash
cd backend

# Run Python linting
uv run flake8 .                                 # Check code quality
uv run black . && uv run isort .              # Auto-format code
uv run python -m py_compile main.py           # Check syntax

# Alternative (with traditional venv)
source venv/bin/activate
flake8 .                                       # Check code quality  
black . && isort .                            # Auto-format code
python -m py_compile main.py                  # Check syntax
```

### 1. `manage_users.py` - User Management Script

Python script for managing admin and uploader users in the FIO Analyzer system.

**Features:**
- Add new users with bcrypt password hashing
- Remove existing users
- List all users
- Separate admin and uploader user management
- Compatible with existing `.htpasswd` and `.htuploaders` files

**Usage:**
```bash
# Activate virtual environment first
cd backend
source venv/bin/activate

# Add admin user
python scripts/manage_users.py add --username admin --password secret --admin

# Add uploader user  
python scripts/manage_users.py add --username uploader --password secret

# List admin users
python scripts/manage_users.py list --admin

# List uploader users
python scripts/manage_users.py list

# Remove admin user
python scripts/manage_users.py remove --username admin --admin

# Remove uploader user
python scripts/manage_users.py remove --username uploader
```

**Options:**
- `add` - Add a new user
- `remove` - Remove an existing user  
- `list` - List all users
- `--admin` - Manage admin users (without this flag, manages uploader users)
- `--username` - Username to add/remove
- `--password` - Password for new users

## 🚨 Important: Database Backup!

**ALWAYS backup your database before running any operations!**

```bash
cp backend/db/storage_performance.db backend/db/storage_performance.db.backup
```

## 🔄 FastAPI Backend Features

The new Python FastAPI backend provides:

- **Auto-generated API documentation** at `http://localhost:8000/docs`
- **Type-safe data validation** with Pydantic models
- **Better performance** compared to Node.js/Express
- **Modern async/await** support
- **Structured logging** with request tracking
- **Backward compatibility** with existing frontend

## 🐳 Docker Support

The backend scripts work in both local development and Docker environments:

```bash
# Local development
cd backend
source venv/bin/activate
python scripts/manage_users.py list --admin

# Docker environment
docker exec -it fio-app python scripts/manage_users.py list --admin
```

## 🔧 Development Setup

For first-time setup:

```bash
# Setup virtual environment
./setup-backend-venv.sh

# Or manual setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 📚 Additional Resources

- **API Documentation**: http://localhost:8000/docs
- **FastAPI Guide**: https://fastapi.tiangolo.com/
- **Migration Summary**: See `MIGRATION_SUMMARY.md` in the root directory
- **Setup Guide**: See `FASTAPI_README.md` in the root directory