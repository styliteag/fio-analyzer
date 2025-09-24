# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI app (`main.py`), API `routers/`, `auth/`, `database/`, `config/`, `utils/`; tooling (`Makefile`, `pyproject.toml`). Data persists under `backend/db/` and uploads in `backend/uploads/`.
- `frontend-vue/`: Vite + Vue.js + TypeScript (`src/`, `vite.config.ts`, `eslint.config.js`).
- `docker/`: Multi‑stage image (`docker/app/Dockerfile`) and compose files.
- `scripts/`: Utilities (`start-frontend-backend.sh`, `fio-analyzer-tests.sh`, `.env.example`).
- `docs/`, `README.md`, `.pre-commit-config.yaml` for shared tooling.

## Build, Test, and Development Commands
- Backend (Python 3.11+):
  - Setup: `cd backend && uv sync` (or `make install`).
  - Quick checks: `make check` (syntax/import), `make lint` (full lint), `make start` (pre-flight + run).
  - Run server: `uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`.
- Frontend:
  - `cd frontend && npm install`.
  - Dev server: `npm run dev`. Build: `npm run build`. Lint: `npm run lint`.
- Full stack:
  - Local: `./start-frontend-backend.sh` (starts backend with `uv` and Vite dev).
  - Docker: `docker compose up --build -d` (see `docker/compose.yml`).

## Coding Style & Naming Conventions
- Python: formatted with Black (88 cols), isort (Black profile), flake8; modules/functions `snake_case`. Routers live in `backend/routers/*.py`.
- TypeScript/Vue.js: ESLint (see `eslint.config.js`) and Prettier via pre-commit; components `PascalCase` (e.g., `HostSelector.vue`), composables `camelCase` (e.g., `useChartColors.ts`).
- Run `pre-commit install` once; commits should pass hooks.

#### CHANGELOG Maintenance
⚠️ **IMPORTANT**: Always update `CHANGELOG.md` when making commits!
- Add new changes under `[Unreleased]` section before committing
- Move to new version section when releasing
- Use semantic versioning format

## Testing Guidelines
- Backend: `pytest` available via `uv run pytest`. Quick smoke: `cd backend && make check` or `python3 test_api.py`.
- Test names: `test_*.py` in `backend/`. Add focused unit tests for routers and utils.
- Browser smoke: `tests-with-browser/` (Playwright). After app is running: `cd tests-with-browser && npm i && node test-app.js`.

## Commit & Pull Request Guidelines
-- If you write code, dont git commit anything without permission from the user!
- Follow Conventional Commits used here (e.g., `feat: …`, `fix: …`, `chore: …`, `refactor: …`). Keep subject imperative and ≤72 chars; add scope when useful.
- PRs: clear description, linked issues, screenshots for UI changes, test plan/steps, and any config notes. Ensure `make check`, `npm run lint`, and pre-commit hooks pass.
- If you change/add/delete API endpoints, run: `python3 scripts/generate_endpoints.py` and commit the updated `docs/api/endpoints.json`.

## Security & Configuration Tips
- Do not commit secrets; copy `.env.example` to `.env`. Backend auth files: `backend/.htpasswd`, `.htuploaders`.
- SQLite path: `backend/db/storage_performance.db`. Persist volumes in Docker (`docker/compose.yml`). Update ports consistently in env, backend settings, and compose.

## Agent Workflow & Quality Gates
- After any frontend change: run `npm run lint` and `npx tsc --noEmit`; fix all errors before PR.
- Prefer `uv run <cmd>` for backend tasks (e.g., `uv run uvicorn ...`, `uv run pytest`). Always run `make check` before starting the backend.
- Manage users with: `cd backend && uv run python scripts/manage_users.py add --username <u> --password <p> [--uploader]`.

## Authentication & Roles
- Admins: full access to UI and management actions. Stored in `backend/.htpasswd`.
- Uploaders: can upload FIO results only. Stored in `backend/.htuploaders`.
- Manage users: `cd backend && uv run python scripts/manage_users.py add --username <u> --password <p> [--uploader]` (use `list`/`remove` accordingly).

## API Quicklinks
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json
- Health check: http://localhost:8000/health

## Docker URLs & Nginx Paths
- Frontend: http://localhost/ (served by nginx).
- API base: http://localhost/api/ → proxies to backend `:8000`.

## VITE_API_URL Configuration

`VITE_API_URL` is a **build-time environment variable** that configures the API base URL for the frontend application:

### How It Works
- **Vite Build System**: Variables prefixed with `VITE_` are embedded into the built application at compile time
- **Client-Side Access**: Available in browser code via `import.meta.env.VITE_API_URL`
- **Build vs Runtime**: Cannot be changed without rebuilding the application

### Environment Configurations

**Development (Default)**:
- `VITE_API_URL=""` (empty string)
- Uses relative URLs like `/api/endpoints`
- Vite dev server proxies `/api` to `http://localhost:8000`

**Docker Production**:
- `VITE_API_URL="/api"`
- Full paths like `/api/endpoints`
- Nginx proxies `/api` to backend container

**Local Development with .env**:
- `VITE_API_URL="http://localhost:8000"`
- Absolute URLs like `http://localhost:8000/api/endpoints`
- Useful when running frontend separately from backend

### Build Process
- **GitHub Actions**: Passes `VITE_API_URL=/api` as build argument
- **Dockerfile**: `ARG VITE_API_URL` → `ENV VITE_API_URL` → embedded in build
- **Frontend Code**: `const API_BASE_URL = import.meta.env.VITE_API_URL || "";`

- Docs: backend serves `/docs` and `/redoc`. If `/api-docs` returns 404, use `/docs` and `/redoc` or adjust nginx:
  - `location /api-docs { proxy_pass http://localhost:8000/docs; }`
  - `location /api-redoc { proxy_pass http://localhost:8000/redoc; }`
- Health: backend path is `/health`. To expose via nginx under `/api/health`, add:
  - `location = /api/health { proxy_pass http://localhost:8000/health; }`
- Compose external URL: port `80:80` (see `docker/compose.yml`). Persist db/uploads/auth via mounted volumes.

Example build with API base injected:
```bash
docker build \
  -f docker/app/Dockerfile \
  --build-arg VITE_API_URL=/api \
  -t fio-analyzer_app .
```

## Major API Endpoints
- Health: `GET /health`
- Info & Filters: `GET /api/info`, `GET /api/filters`
- Test Runs:
  - `GET /api/test-runs/` (list with filters)
  - `GET /api/test-runs/performance-data?test_run_ids=1,2`
  - `GET /api/test-runs/{test_run_id}`
  - `PUT /api/test-runs/{test_run_id}`
  - `PUT /api/test-runs/bulk`
  - `DELETE /api/test-runs/{test_run_id}`
- Imports:
  - `POST /api/import/` (single JSON upload)
  - `POST /api/import/bulk` (scan `backend/uploads/`)
- Time Series:
  - `GET /api/time-series/servers`, `GET /api/time-series/all`
  - `GET /api/time-series/latest`, `GET /api/time-series/history`, `GET /api/time-series/trends`
  - `PUT /api/time-series/bulk`, `DELETE /api/time-series/delete`
- Users:
  - `GET /api/users/`, `GET /api/users/me`, `POST /api/users/`
  - `GET /api/users/{username}`, `PUT /api/users/{username}`, `DELETE /api/users/{username}`

For the full, parameterized reference (examples, schemas), use Swagger at `/docs` or ReDoc at `/redoc`. A machine-readable index is at `docs/api/endpoints.json`.