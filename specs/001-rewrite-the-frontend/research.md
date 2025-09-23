# Research: Vue Migration

## Decisions
- Use Vue 3 (Composition API)
- 2D charts: Chart.js via vue-chartjs
- 3D charts: Three.js
- Directory: `frontend-vue/`
- Backend unchanged; API contracts preserved
- Performance target: <500ms initial chart render (typical dataset)

## Rationale
- Vue 3 offers modern patterns and ecosystem stability.
- Chart.js preserves parity and smaller bundle; vue-chartjs integration is mature.
- Three.js provides full 3D control beyond limited 3D plugins.
- Separate directory enables safe, incremental migration and rollback.

## Alternatives Considered
- ECharts + ECharts GL: Rich features but heavier bundle and migration cost.
- Chart.js 3D plugins: Limited capabilities for required 3D visuals.
- In-place migration within `frontend/`: Higher risk, difficult rollback.

## Priority Research: Radar Chart Implementation
- **Decision**: Implement radar chart using Chart.js radar type with vue-chartjs
- **Rationale**: Critical for FR-003 compliance; Chart.js radar provides sufficient control
- **Performance**: Target <500ms render with ≤5 datasets × ≤200 points; use decimation for larger sets
- **Accessibility**: Ensure keyboard navigation for legend toggles, proper ARIA labels

## Open Notes
- Validate large dataset rendering strategies (downsampling, decimation).
- Confirm router structure parity with current pages.
