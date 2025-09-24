# FIO Analyzer Constitution

## Core Principles

### I. Test-Driven Development (NON-NEGOTIABLE)
Every feature must follow TDD: Tests written → User approved → Tests fail → Then implement. Red-Green-Refactor cycle strictly enforced.

### II. API-First Design
All data integration must use existing backend APIs. No direct database access from frontend. Contract tests required for all API endpoints.

### III. User Experience Focus
Interface must be intuitive, responsive, and accessible. Error states must be user-friendly with detailed logging for developers.

### IV. Performance Standards
Dashboard must load in <200ms after API response. Visualizations must handle 1000+ data points smoothly. Bundle size must be optimized.

### V. Data Integrity
All visualizations must derive data from `/api/test-runs` and `/api/filters` only. No `/api/time-series` usage. Relative color scaling required for heatmaps.

## Development Workflow
- All changes must pass TypeScript compilation and ESLint
- Contract tests must pass before implementation
- Integration tests must validate complete user workflows
- Performance benchmarks must be met

## Governance
Constitution supersedes all other practices. Amendments require documentation, approval, and migration plan. All PRs/reviews must verify compliance. Complexity must be justified.

**Version**: 1.0.0 | **Ratified**: 2025-09-24 | **Last Amended**: 2025-09-24