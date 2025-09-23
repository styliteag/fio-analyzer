# FIO Analyzer - Vue Frontend (`frontend-vue/`)

## Overview
Complete Vue.js 3 + TypeScript frontend with full feature parity to the React frontend. This Vue implementation provides identical functionality while maintaining the same API contracts and user experience.

## Development
```bash
cd frontend-vue
npm install
npm run dev   # http://localhost:5174 (proxies /api → http://localhost:8000)
```

## Build
```bash
npm run build           # outputs dist/ (optimized with code splitting)
npm run preview         # preview prod build at :5174
```

## Quality Assurance
```bash
npm run lint            # ESLint (Vue 3 + TypeScript rules)
npx tsc --noEmit        # TypeScript type checking
```

## Configuration
- `VITE_API_URL` (build-time):
  - Dev default: empty string "" → uses Vite proxy `/api` → `http://localhost:8000`
  - Docker prod: set to `/api` (nginx proxies to backend)

## Routes (Complete Implementation)
- `/` Home (dashboard with statistics and quick links)
- `/test-runs` Test Runs (data table with filtering and pagination)
- `/host` Host Analysis (detailed performance visualization)
- `/filters` Advanced Filters (comprehensive filtering options)
- `/users` User Management (admin-only user administration)
- `/login` Authentication (login/logout functionality)

## Architecture
- **Framework**: Vue 3 Composition API with `<script setup>` syntax
- **State Management**: Vue 3 reactivity with composables (no external state library)
- **Charts**: Chart.js via `vue-chartjs` (2D) + Three.js (3D)
- **Styling**: TailwindCSS (identical to React version)
- **Type Safety**: Full TypeScript with comprehensive interfaces

## Key Components
- **Pages**: TestRuns.vue, Host.vue, Filters.vue, UserManager.vue
- **Charts**: RadarChart.vue, BasicLineChart.vue, ThreeDBarChart.vue
- **UI Components**: PaginationControls.vue, ExportButtons.vue, FullscreenContainer.vue
- **Composables**: useAuth.ts, useTestRuns.ts, useFilters.ts, useErrorHandler.ts

## Migration Notes
- Complete feature parity with React frontend maintained
- Backend API contracts unchanged and fully preserved
- Visual differences allowed, functionality must be identical
- Performance targets: user interaction responsiveness comparable to React
- All quality gates pass (linting, TypeScript, build optimization)


