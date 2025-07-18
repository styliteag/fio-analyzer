#!/bin/bash

# FIO Analyzer Development Server Startup Script
# Starts both the Python FastAPI backend and React frontend in development mode
# 
# Backend: FastAPI with uvicorn (Python virtual environment)
# Frontend: React with Vite dev server
#
# Usage: ./start-frontend-backend.sh

# Enable job control for process group management
set -m

# Function to clean up background processes
cleanup() {
    echo -e "\nShutting down servers..."
    if [ -n "$backend_pid" ]; then
        # Kill the entire process group for the backend
        # Redirecting stderr to /dev/null to suppress "kill: no such process"
        kill -SIGTERM -- -$backend_pid 2>/dev/null
        echo "Backend server stopped."
    fi
    exit
}

# Trap termination signals to run the cleanup function
trap cleanup SIGINT SIGTERM

# Start backend in the background with Python virtual environment
echo "Setting up and starting backend..."
(
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install/upgrade pip and dependencies
    echo "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Start FastAPI server
    echo "Starting FastAPI backend server..."
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
) &
backend_pid=$!

# Start frontend in the foreground
echo "Setting up and starting frontend..."
(cd frontend && npm install && npm run dev)
# Clean up background processes
cleanup

exit 0