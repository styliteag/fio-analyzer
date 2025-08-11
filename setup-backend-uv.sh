#!/bin/bash

# FIO Analyzer Backend Setup Script with uv
# Uses uv package manager for fast Python dependency management

echo "🚀 Setting up FIO Analyzer backend with uv..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install uv first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo "   or"
    echo "   brew install uv"
    exit 1
fi

# Navigate to backend directory
cd backend

# Show uv version
uv_version=$(uv --version)
echo "📋 Found uv version: $uv_version"

# Check if .venv exists
if [ -d ".venv" ]; then
    echo "📁 Virtual environment already exists at backend/.venv"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing existing virtual environment..."
        rm -rf .venv
        rm -f uv.lock
    else
        echo "📦 Using existing virtual environment..."
    fi
fi

# Sync dependencies with uv
echo "📦 Installing Python dependencies with uv..."
uv sync

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Show completion message
echo ""
echo "🎉 Backend setup with uv complete!"
echo ""
echo "To run commands in the virtual environment:"
echo "  cd backend"
echo "  uv run <command>"
echo ""
echo "To start the backend server:"
echo "  uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "To start both frontend and backend:"
echo "  ./start-frontend-backend.sh"
echo ""
echo "API documentation will be available at:"
echo "  http://localhost:8000/docs"
echo "  http://localhost:8000/redoc"