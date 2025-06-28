#!/bin/bash

# Quick start script for FIO Analyzer development
echo "🚀 Starting FIO Analyzer (Backend + Frontend)..."

# Kill any existing processes
echo "🛑 Stopping existing servers..."
pkill -f "node index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start backend in background
echo "🔧 Starting backend server..."
cd /Users/bonis/src/fio-analyzer/backend
npm start > /tmp/fio-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend..."
sleep 3

# Test backend is ready
for i in {1..10}; do
    if curl -s -u admin:admin http://localhost:8000/api/test-runs > /dev/null 2>&1; then
        echo "✅ Backend ready on http://localhost:8000"
        break
    fi
    echo "⏳ Backend starting... ($i/10)"
    sleep 1
done

# Start frontend in background
echo "🎨 Starting frontend server..."
cd /Users/bonis/src/fio-analyzer/frontend
npm run dev > /tmp/fio-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend
echo "⏳ Waiting for frontend..."
sleep 5

# Test frontend is ready
for i in {1..10}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ Frontend ready on http://localhost:5173"
        break
    fi
    echo "⏳ Frontend starting... ($i/10)"
    sleep 1
done

echo ""
echo "🎉 FIO Analyzer is ready!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   Login:    admin/admin"
echo ""
echo "📋 Process IDs:"
echo "   Backend:  $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/fio-backend.log"
echo "   Frontend: tail -f /tmp/fio-frontend.log"
echo ""
echo "🛑 To stop: pkill -f 'node index.js'; pkill -f 'vite'"