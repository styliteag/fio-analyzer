# FIO Analyzer - Vue Frontend (`frontend-vue/`)

## Development
```bash
cd frontend-vue
npm install
npm run dev   # http://localhost:5174 (proxies /api → http://localhost:8000)
```

## Build
```bash
npm run build           # outputs dist/
npm run preview         # preview prod build at :5174
```

## Lint & Type-Check
```bash
npm run lint
npx tsc --noEmit
```

## Configuration
- `VITE_API_URL` (build-time):
  - Dev default: empty string "" → uses Vite proxy `/api` → `http://localhost:8000`
  - Docker prod: set to `/api` (nginx proxies to backend)

## Routes (parity targets)
- `/` Home (info)
- `/filters`, `/test-runs`, `/performance`, `/history` (time-series)
- `/upload` (auth required)
- `/admin`, `/users` (admin only)
- `/login` (basic auth)

## Charts
- 2D: Chart.js via `vue-chartjs`
- 3D: Three.js (`ThreeDBarChart.vue`)

## Notes
- Backend is unchanged; API parity preserved
- Request cancellation and Chart.js decimation enabled by default


