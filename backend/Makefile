# FIO Analyzer Backend Makefile

.PHONY: check syntax lint test start clean help api-index

# Quick syntax and import check (no venv needed)
check:
	@echo "🔍 Running quick syntax and import checks..."
	@python3 quick_check.py

# Basic syntax check only
syntax:
	@echo "🔍 Running syntax checks..."
	@python3 -m py_compile main.py
	@python3 -m py_compile auth/middleware.py
	@python3 -m py_compile routers/*.py
	@echo "✅ All syntax checks passed"

# Full lint (requires venv)
lint:
	@echo "🔍 Running comprehensive linting..."
	@if [ -d "venv" ]; then \
		source venv/bin/activate && python3 lint_check.py; \
	else \
		echo "⚠️  Virtual environment not found. Running basic checks..."; \
		python3 quick_check.py; \
	fi

# Start development server
start:
	@echo "🚀 Starting development server..."
	@make check
	@if [ $$? -eq 0 ]; then \
		echo "✅ Pre-flight checks passed. Starting server..."; \
		source venv/bin/activate && python3 main.py; \
	else \
		echo "❌ Pre-flight checks failed. Fix issues before starting."; \
		exit 1; \
	fi

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@python3 -m venv venv
	@source venv/bin/activate && pip install -r requirements.txt

# Clean cache files
clean:
	@echo "🧹 Cleaning cache files..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@echo "🧹 Remove venv"
	@rm -rf venv

# Show help
help:
	@echo "FIO Analyzer Backend Commands:"
	@echo ""
	@echo "  make check    - Quick syntax and import validation"
	@echo "  make syntax   - Basic syntax check only"
	@echo "  make lint     - Comprehensive linting (requires venv)"
	@echo "  make start    - Run pre-flight checks and start server"
	@echo "  make install  - Set up virtual environment and dependencies"
	@echo "  make clean    - Remove cache files"
	@echo "  make api-index - Regenerate docs/api/endpoints.json from routers"
	@echo "  make help     - Show this help message"
	@echo ""
	@echo "Before starting the server, always run 'make check' first!"

# Generate machine-readable API endpoints index
api-index:
	@echo "📚 Generating API endpoints index..."
	@cd .. && python3 scripts/generate_endpoints.py
	@echo "✅ Wrote docs/api/endpoints.json"
