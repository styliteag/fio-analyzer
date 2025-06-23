#!/bin/bash

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

# Start backend in the background
echo "Setting up and starting backend..."
(cd backend && npm install && npm start) &
backend_pid=$!

# Start frontend in the foreground
echo "Setting up and starting frontend..."
(cd frontend && npm install && npm run dev)
# Clean up background processes
cleanup

exit 0