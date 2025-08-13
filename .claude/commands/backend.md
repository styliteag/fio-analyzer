# FastAPI Backend Assistant

Manage Python FastAPI backend operations for $ARGUMENTS.

## Task

I'll help you with backend development by:

1. Starting/stopping the FastAPI server with uv
2. Managing Python dependencies and virtual environment
3. Running database operations and user management
4. Checking syntax and running backend tests
5. Deploying with Docker containers
6. API documentation and endpoint testing

## Process

I'll follow these steps:

1. Check backend project structure and dependencies
2. Use uv for Python package management (preferred) or fallback to venv
3. Execute backend-specific commands in the correct directory
4. Validate syntax before running operations
5. Use auto-generated API docs for testing endpoints

## Common Backend Commands

### Development Server
```bash
# Using uv (recommended)
cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Using traditional venv
cd backend && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Combined frontend + backend
./start-frontend-backend.sh
```

### User Management
```bash
cd backend
uv run python scripts/manage_users.py add --username admin --password secret
uv run python scripts/manage_users.py list
uv run python scripts/manage_users.py add --username uploader --password secret --uploader
```

### Database Operations
```bash
cd backend
rm db/storage_performance.db  # Reset database
sqlite3 db/storage_performance.db  # Direct database access
```

### Testing & Validation
```bash
cd backend
uv run python check_syntax.py  # Syntax validation
uv run python test_api.py      # API testing
```

### Docker Operations
```bash
cd docker
docker compose up --build      # Development
docker compose -f compose.prod.yml up -d  # Production
```

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc  
- **OpenAPI JSON**: http://localhost:8000/openapi.json

I'll adapt to your specific backend requirements and ensure proper error handling for FastAPI operations.