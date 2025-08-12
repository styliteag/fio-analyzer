# Development Setup Guide

This guide covers setting up the FIO Analyzer for development.

## Prerequisites

- **Python**: 3.8 or later (3.11+ recommended)
- **Node.js**: 18 or later
- **Git**: Latest version
- **uv** (recommended): Fast Python package manager

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd fio-analyzer
   ```

2. **Environment files**:
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   # Edit files as needed
   ```

3. **Automated setup**:
   ```bash
   ./start-frontend-backend.sh
   ```

## Manual Setup

### Backend Setup

#### Option 1: Using uv (Recommended)
```bash
cd backend
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Option 2: Traditional venv
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Development Tools

### Pre-commit Hooks

Install pre-commit hooks for code quality:

```bash
pip install pre-commit
pre-commit install
```

This will automatically run:
- Black (Python formatting)
- isort (import sorting)
- Prettier (JS/TS formatting)
- Flake8 (Python linting)
- Security checks (Bandit)

### Code Quality

#### Backend
```bash
cd backend
# Linting
python lint_check.py

# Syntax check
python check_syntax.py

# Quick validation
python quick_check.py
```

#### Frontend
```bash
cd frontend
# Linting
npm run lint

# Type checking
npx tsc --noEmit

# Build check
npm run build
```

## Testing

### Backend Testing
```bash
cd backend
python test_api.py  # Quick API test
```

### Frontend Testing
```bash
cd frontend
npm test  # If tests are configured
```

## Database Management

### Reset Database
```bash
rm backend/db/storage_performance.db
# Database will be recreated on next startup
```

### User Management
```bash
cd backend
# Add admin user
uv run python scripts/manage_users.py add --username admin --password secret

# Add uploader user  
uv run python scripts/manage_users.py add --username uploader --password secret --uploader

# List users
uv run python scripts/manage_users.py list
```

## Docker Development

```bash
cd docker
docker compose up --build
```

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   lsof -i :8000  # Check what's using port 8000
   kill -9 <PID>  # Kill process if needed
   ```

2. **Python dependencies**:
   ```bash
   cd backend
   rm -rf venv  # Remove virtual environment
   ./setup-backend-venv.sh  # Recreate
   ```

3. **Frontend dependencies**:
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

### Environment Variables

See `.env.example` files for all available configuration options.

### Debugging

1. **Backend**: Logs are output to console with structured JSON
2. **Frontend**: Use browser dev tools, React Dev Tools extension
3. **API**: Use Swagger UI at `/docs` for interactive testing

## IDE Setup

### VS Code
Recommended extensions:
- Python
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

### PyCharm/IntelliJ
- Configure Python interpreter to use venv
- Enable ESLint for frontend files