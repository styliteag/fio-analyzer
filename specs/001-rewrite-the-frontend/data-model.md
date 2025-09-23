# Data Model & View Contracts

## Entities
- Test Run: id, metadata, metrics (IOPS, bandwidth, avg_latency, p95, p99), operation_type
- Performance Data Series: time, metric_type, value, unit, operation_type
- User: username, role (admin|uploader)

## Views → Endpoints
- Home/Info: GET /api/info
- Filters: GET /api/filters
- Test Runs List: GET /api/test-runs/
- Performance Data: GET /api/test-runs/performance-data?test_run_ids=...
- Time Series: GET /api/time-series/* (servers, all, latest, history, trends)
- Upload: POST /api/import/ and POST /api/import/bulk
- Admin Users: GET/POST/PUT/DELETE /api/users/*

## Constraints
- No backend changes; schemas as documented in Swagger.
- Respect auth roles for all actions.

## UI State (per view)
- Filters: selected host, model, type, pattern, block size
- Selections: chosen test run ids
- Chart State: visible series, sort/group options, export format
