# Tasks: Rewrite Frontend to Vue.js

**Input**: Design documents from `/specs/001-rewrite-the-frontend/`
**Prerequisites**: plan.md (required), research.md, data-model.md, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: integration checks per quickstart
   → Core: routing, auth, services, pages, charts
   → Integration: build config, env, nginx paths
   → Polish: performance, docs
4. Apply task rules and order
5. Number tasks sequentially (T001, T002...)
6. Create parallel execution examples
7. Return: SUCCESS
```

## Tasks

### Phase 3.1: Setup
- [X] T001 Initialize Vue app in `frontend-vue/` (Vite + TypeScript)
- [X] T002 Configure dependencies: `vue`, `vue-router`, `pinia`, `chart.js`, `vue-chartjs`, `three`
- [X] T003 [P] Configure ESLint + TypeScript config matching repo standards
- [X] T004 Align `VITE_API_URL` env handling (dev proxy for `/api`, prod `/api` base)
- [X] T005 Add basic app shell with router and layout

### Phase 3.2: Tests First (Validation stubs)
- [ ] T006 [P] Quickstart smoke: navigation to all target routes
- [ ] T007 [P] Quickstart smoke: auth login/logout flow with role gating
- [ ] T008 [P] Quickstart smoke: initial chart render under 500ms baseline

### Phase 3.3: Core Implementation
- [X] T009 Router: define routes for Home, Performance, Compare, History, Host, Upload, Admin, UserManager
- [ ] T010 Auth: login form and role handling (admin/uploader), token/basic auth parity with existing flows
- [ ] T011 Services: API client honoring `VITE_API_URL`; endpoints per data-model.md
- [ ] T012 Pages: Home/Info consuming `/api/info`
- [X] T013 Pages: Filters consuming `/api/filters`
- [X] T014 Pages: Test Runs list consuming `/api/test-runs/`
- [X] T015 Pages: Performance Data view consuming `/api/test-runs/performance-data`
- [X] T016 Pages: Time Series views consuming `/api/time-series/*`
- [X] T017 Upload page: POST `/api/import` (+ bulk)
- [X] T018 Admin Users: CRUD actions mapping to `/api/users/*`
- [ ] T019 Shared: filter components, selectors, pagination, export (PNG/CSV)
- [ ] T020 Charts (2D): Chart.js components for metrics/time-series
- [ ] T021 Charts (3D): Three.js component for 3D bar chart parity

### Phase 3.4: Integration
- [X] T022 Performance optimizations: decimation/downsampling, memoization-equivalent patterns
- [X] T023 Request cancellation for data fetches
- [X] T024 Build: production build and Docker/nginx path checks

### Phase 3.5: Polish
- [X] T025 [P] Accessibility pass and responsive checks
- [X] T026 [P] Documentation updates: README, CHANGELOG [Unreleased]
- [X] T027 [P] Perf check: verify <500ms initial render; adjust if needed

## Dependencies
- Setup (T001-T005) before Core
- Validation stubs (T006-T008) can run in parallel after setup
- Router/auth/services (T009-T011) before pages (T012-T018)
- 2D charts (T020) before 3D (T021)
- Integration before Polish

## Parallel Example
```
# After setup:
Run in parallel:
- T006 Quickstart nav smoke
- T007 Auth smoke
- T008 Initial chart render baseline
```

## Notes
- Backend remains unchanged; rely on existing endpoints
- Use `frontend-vue/` until parity, then decommission `frontend/`
