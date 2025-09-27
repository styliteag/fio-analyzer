#!/bin/sh

# Comprehensive health check for FIO Analyzer
# Checks nginx, FastAPI backend, and frontend static files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 FIO Analyzer Health Check"
echo "=============================="

# Check 1: Nginx process
echo -n "1. Checking nginx process... "
if pgrep nginx > /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi

# Check 2: Nginx listening on port 80
echo -n "2. Checking nginx on port 80... "
if wget --no-verbose --tries=1 --spider http://127.0.0.1:80 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Responding${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
    exit 1
fi

# Check 3: Frontend static files
echo -n "3. Checking frontend static files... "
if [ -f "/usr/share/nginx/html/index.html" ]; then
    echo -e "${GREEN}✓ Present${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    exit 1
fi

# Check 4: FastAPI backend process
echo -n "4. Checking FastAPI backend process... "
if pgrep -f "uvicorn main:app" > /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi

# Check 5: FastAPI backend on port 8000
echo -n "5. Checking FastAPI backend on port 8000... "
if wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Responding${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
    exit 1
fi

# Check 6: Frontend served by nginx
echo -n "6. Checking frontend served by nginx... "
if wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Accessible${NC}"
else
    echo -e "${RED}✗ Not accessible${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All health checks passed!${NC}"
echo "FIO Analyzer is running properly."
echo ""
echo "Access points:"
echo "  • Frontend: http://localhost/"
echo "  • API Docs: http://localhost/api-docs"
echo "  • Health: http://localhost/api/health" 