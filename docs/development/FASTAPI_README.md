# FIO Analyzer FastAPI Backend

This project has been migrated from Node.js/Express to Python FastAPI for improved performance and developer experience.

## 🚀 Quick Start

### Option 1: Automatic Setup (Recommended)
```bash
# Start both frontend and backend with automatic venv setup
./start-frontend-backend.sh
```

### Option 2: Manual Setup
```bash
# Setup virtual environment (one time)
./setup-backend-venv.sh

# Start backend manually
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Start frontend (in separate terminal)
cd frontend
npm install
npm run dev
```

### Option 3: Direct Python (System-wide packages)
```bash
# Install dependencies system-wide (not recommended for production)
cd backend
pip3 install -r requirements.txt --break-system-packages

# Start backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 🌐 Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Alternative API Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 📋 Requirements

- **Python**: 3.8 or later
- **Node.js**: 18 or later (for frontend)
- **pip**: Latest version

## 🔧 Development

### Backend Development
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### User Management
```bash
# Add admin user
cd backend
source venv/bin/activate
python scripts/manage_users.py add --username admin --password secret --admin

# Add uploader user
python scripts/manage_users.py add --username uploader --password secret

# List users
python scripts/manage_users.py list --admin
```

## 🐳 Docker Deployment

The Docker setup has been updated to use Python:

```bash
cd docker
docker compose up --build
```

## 🆚 Migration Notes

### What Changed
- **Backend**: Node.js/Express → Python FastAPI
- **Server**: npm start → uvicorn
- **Dependencies**: package.json → requirements.txt
- **Virtual Environment**: Added Python venv support

### What Stayed the Same
- **Frontend**: React + Vite (unchanged)
- **API Endpoints**: Identical functionality
- **Database**: Same SQLite schema
- **Authentication**: Same htpasswd files
- **Docker**: Same container structure

## 🎯 Benefits

- **Performance**: FastAPI is significantly faster than Express.js
- **Type Safety**: Pydantic models with runtime validation
- **Auto Documentation**: OpenAPI/Swagger generated automatically
- **Modern Python**: Full async/await support with type hints
- **Better Error Handling**: Structured error responses
- **Dependency Injection**: Clean architecture patterns

## 🔍 Troubleshooting

### Virtual Environment Issues
```bash
# Remove and recreate venv
rm -rf backend/venv
./setup-backend-venv.sh
```

### Dependency Issues
```bash
# Update pip and reinstall
cd backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Port Conflicts
```bash
# Check what's using port 8000
lsof -i :8000

# Kill process if needed
kill -9 <PID>
```

## 📚 API Documentation

The FastAPI backend automatically generates comprehensive API documentation:

- **Swagger UI**: Interactive API testing interface
- **ReDoc**: Clean, three-panel documentation
- **OpenAPI JSON**: Machine-readable API specification

All endpoints from the original Node.js backend are preserved with identical functionality.