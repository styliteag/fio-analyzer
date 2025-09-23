<!--
Sync Impact Report
- Version change: N/A → 1.0.0
- Modified principles: (new document)
- Added sections: Core Principles; Architecture & Constraints; Workflow & Quality Gates; Governance
- Removed sections: none
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md (version reference updated)
  ✅ .specify/templates/spec-template.md (no changes required)
  ✅ .specify/templates/tasks-template.md (no changes required)
  ✅ .specify/templates/agent-file-template.md (no changes required)
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Original adoption date unknown; set when known.
-->

# FIO Analyzer Constitution

## Core Principles

### I. Simplicity First
All changes MUST minimize complexity and diff size while preserving clarity. Prefer
small, focused edits that solve the problem without refactoring unrelated code.
Names MUST be self-explanatory; avoid premature abstractions. Rationale: smaller
changes are easier to review, safer to ship, and align with the project's
"fewer lines of code" ethos.

### II. Test-First Quality Gates
Critical functionality MUST be protected by tests. Frontend changes MUST pass
`npm run lint` and `npx tsc --noEmit`. Backend changes MUST pass `make check`
and `uv run pytest` where applicable. CI and reviewers MUST block merges that
fail gates. Rationale: enforce correctness before integration and prevent
regressions.

### III. Documentation & CHANGELOG Discipline
Significant changes MUST update `README.md` or relevant docs and append entries
under `[Unreleased]` in `CHANGELOG.md` prior to commit. API changes MUST update
`docs/api/endpoints.json` via `scripts/generate_endpoints.py`. Rationale: keep
users and maintainers aligned and ensure traceability.

### IV. Security & Configuration Hygiene
Secrets MUST NOT be committed. Use environment variables and documented config
(`VITE_API_URL`, `.env`, Docker compose). Authentication roles (admin,
uploader) MUST be respected in UI and API. Rationale: protect credentials and
enforce least privilege.

### V. Performance & Observability
Frontend MUST optimize rendering (memoization, request cancellation) and keep
bundle size lean. Backend MUST log meaningfully and avoid unnecessary queries.
New features SHOULD include basic metrics/logs for troubleshooting. Rationale:
the app is visualization-heavy and performance-sensitive.

## Architecture & Constraints

This is a web application composed of a React + TypeScript + Vite frontend and
a Python FastAPI backend with SQLite (or PostgreSQL) storage. Docker provides a
single-container production deployment with nginx proxying `/api` to the
backend.

- Frontend configuration: `VITE_API_URL` is a build-time variable; runtime
  changes require rebuilds. Dev uses relative `/api` via Vite proxy.
- Backend conventions: Routers in `backend/routers/`, auth files in project
  root, DB path `backend/db/storage_performance.db`.
- API stability: Maintain RESTful paths documented in Swagger. Breaking changes
  require a migration note and version bump per Governance.

## Workflow & Quality Gates

- Branching and PRs: Follow Conventional Commits. Keep PRs small and scoped.
- Validation: Frontend `npm run lint` + `npx tsc --noEmit`; Backend `make check`
  + `uv run pytest` when tests exist; docker compose builds must pass locally
  for deployment docs.
- Reviews: Reviewers MUST reject changes violating Core Principles. Changes that
  touch APIs MUST include updated docs and, when applicable, contract tests.
- Documentation: Update relevant docs alongside code; do not defer.

## Governance

- Authority: This constitution supersedes other process docs where conflicts
  exist. Exceptions require explicit rationale in PR description.
- Amendments: Propose via PR modifying this document with a Sync Impact Report
  at top. Determine version bump (MAJOR/MINOR/PATCH) based on semantic impact.
  Record `Last Amended` date.
- Compliance: All PR templates and reviewers MUST check compliance with
  principles and gates. Non-compliant PRs MUST be revised or closed.
- Versioning Policy: See version line below. MAJOR for removals/redefinitions,
  MINOR for new principles/sections or materially expanded guidance, PATCH for
  clarifications.

**Version**: 1.0.0 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-23