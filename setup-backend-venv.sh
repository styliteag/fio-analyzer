#!/bin/bash

# FIO Analyzer Backend Virtual Environment Setup Script
# Creates and configures a Python virtual environment for the FastAPI backend

echo "🐍 Setting up Python virtual environment for FIO Analyzer backend..."

# Navigate to backend directory
cd backend

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or later."
    exit 1
fi

# Check Python version
python_version=$(python3 --version | cut -d' ' -f2)
echo "📋 Found Python version: $python_version"

# Create virtual environment
if [ -d "venv" ]; then
    echo "📁 Virtual environment already exists at backend/venv"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing existing virtual environment..."
        rm -rf venv
    else
        echo "📦 Using existing virtual environment..."
    fi
fi

if [ ! -d "venv" ]; then
    echo "🏗️  Creating virtual environment..."
    python3 -m venv venv
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
    
    echo "✅ Virtual environment created successfully"
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Show completion message
echo ""
echo "🎉 Backend virtual environment setup complete!"
echo ""
echo "To activate the virtual environment manually:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo ""
echo "To start the backend server:"
echo "  uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "To start both frontend and backend:"
echo "  ./start-frontend-backend.sh"
echo ""
echo "API documentation will be available at:"
echo "  http://localhost:8000/docs"
echo "  http://localhost:8000/redoc"