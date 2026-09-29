# FIO Analyzer API Documentation

## Overview

The FIO Analyzer provides a comprehensive REST API for analyzing FIO (Flexible I/O Tester) benchmark results and monitoring storage performance over time. The API is built with FastAPI and provides automatic interactive documentation.

## API Documentation Access

The API provides three ways to access documentation:

1. **Swagger UI** (Interactive): http://localhost:8000/docs
2. **ReDoc** (Clean Documentation): http://localhost:8000/redoc
3. **OpenAPI JSON** (Machine-readable): http://localhost:8000/openapi.json

## Authentication

The API uses HTTP Basic Authentication with three user roles:
- **Admin**: Full access to all endpoints and user management
- **Viewer**: Read-only access to all read endpoints, including raw JSON downloads
- **Uploader**: Can only upload test data (`POST /api/import`)

Authenticated users without the required role get HTTP 403; missing or invalid credentials get HTTP 401.

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Test Runs Management
- `GET /api/test-runs/` - Get test runs with advanced filtering
- `PUT /api/test-runs/bulk` - Bulk update test runs
- `GET /api/test-runs/performance-data` - Get detailed performance metrics
- `GET /api/test-runs/{test_run_id}` - Get single test run
- `PUT /api/test-runs/{test_run_id}` - Update test run
- `DELETE /api/test-runs/{test_run_id}` - Delete test run

### Data Import
- `POST /api/import/` - Import FIO test data from JSON file
- `POST /api/import/bulk` - Bulk import from server directory

Multi-client runs (`fio --client=… job.fio`, sent by `fio-test.sh` in controller mode) are detected from fio's `client_stats`: the step is stored once with the metrics of fio's "All clients" result and `clients` = number of clients, plus one row per client. Optional form fields: `ramp_uuid` (≤ 64 chars, groups the client-count steps of one test configuration), `client_hosts` (comma list of client names) and `client_storage_info` (JSON object `"host:port"` or `"host"` → that client's storage_info, ≤ 256 KiB).

### Time Series Analytics
- `GET /api/time-series/servers` - Get server list with statistics
- `GET /api/time-series/all` - Get all historical data
- `GET /api/time-series/latest` - Get latest time series data
- `GET /api/time-series/history` - Get historical time series with filtering
- `GET /api/time-series/trends` - Analyze performance trends
- `PUT /api/time-series/bulk` - Bulk update time series data
- `DELETE /api/time-series/delete` - Delete time series data

### Dashboard
- `GET /api/dashboard/stats` - Aggregated counts, averages and last upload time (admin only; computed in SQL, a few hundred bytes)

### Saturation
- `GET /api/saturation/runs/{run_uuid}/summary?threshold_ms=` - Per pattern: best step within the P95 threshold (highest IOPS) and the first step above it. Uses the stored threshold unless `threshold_ms` is given
- `GET /api/test-runs/saturation-data?run_uuid=&threshold_ms=` - Chart data; `threshold_ms` defaults to the stored threshold (100 ms for older runs)

### Client Ramps
- `GET /api/ramp/runs?hostname=&run_uuid=&limit=` - Multi-client ramps (one per `ramp_uuid`), newest first, with test configuration, client counts and number of steps
- `GET /api/ramp/runs/{ramp_uuid}` - All steps in client-count order: aggregate metrics plus per-client results (`clients_detail`, incl. each client's `storage_info`)
- `GET /api/ramp/runs/{ramp_uuid}/summary?threshold_ms=100` - Highest client count whose P95 stays within the threshold (`best_within`), first count above it (`crossed_at`), highest aggregate IOPS (`max_iops`), drop of per-client IOPS from the smallest to the largest step (`per_client_iops_drop_pct`) and per-step `fairness` (slowest / fastest client IOPS). Incomplete steps (a client failed) are listed but not ranked

### Comparison
- `GET /api/compare/targets?source=latest|history` - All Host-Protocol-Type-Model combinations with test runs, as `target` values
- `GET /api/compare?target=A&target=B[&target=C…]` - Compare 2–10 targets side by side. By default (`strict=true`) only identical configurations are compared, including test size, duration, the layout tags `prefill`/`fileperjob`/`satcap`/`cachefit` and the client count (`clients`); `strict=false` matches loosely and reports differing fields in `mismatch`. A target is `hostname|protocol|drive_type|drive_model`; trailing parts may be omitted or `*`. The first target is the baseline; every other target gets `diff_pct` per metric (iops, bandwidth, avg/p95/p99 latency) and a `better` flag. Options: `source=latest|history`, `patterns`, `block_sizes`, `syncs`, `include_incomplete`, plus the run filters below

### Import Log
- `GET /api/import-log/runs/{run_uuid}` - Upload attempts per outcome (`imported`, `rejected`, `error`) plus rows stored for the run, and the failed attempts with reasons
- `GET /api/import-log/?run_uuid=&status=&hostname=&since=&until=&limit=` - List upload attempts, newest first

### Raw Data
- `GET /api/raw/test-runs/{id}?source=latest|history|saturation` - Download the uploaded fio JSON of one test run (`latest` = id returned by uploads)
- `GET /api/raw/runs/{run_uuid}` - Download all fio JSON files of a script run (incl. saturation steps) as ZIP; `index.json` maps files to test runs and lists missing files
- `GET /api/raw/ramps/{ramp_uuid}` - Download the fio JSON files of all steps of a multi-client ramp as ZIP

### Utilities
- `GET /api/filters` - Get available filter options
- `GET /api/info` - Get API information and metadata

### User Management
- `GET /api/users/` - List all users (admin only)
- `GET /api/users/me` - Get current user information
- `POST /api/users/` - Create new user (admin only)
- `GET /api/users/{username}` - Get user details (admin only)
- `PUT /api/users/{username}` - Update user (admin only)
- `DELETE /api/users/{username}` - Delete user (admin only)

## Common Query Parameters

### Filtering Parameters
Most endpoints support filtering with these common parameters:
- `hostnames` - Comma-separated list of hostnames
- `drive_types` - Drive types (NVMe, SATA, SAS)
- `drive_models` - Specific drive models
- `protocols` - Storage protocols (Local, iSCSI, NFS)
- `patterns` - I/O patterns (randread, randwrite, read, write)
- `block_sizes` - Block sizes (4K, 8K, 64K, 1M)
- `queue_depths` - Queue depths (1, 8, 32, 64)
- `syncs` - fio sync modes: `none`, `sync`, `dsync` (legacy `0`/`1` accepted)
- `directs` - Direct I/O flags (0=buffered, 1=direct)

### Run Filters
- `tags` - Comma-separated description tags that must all be present, e.g. `prefill:1,fileperjob:1` or `cachefit:1` (fio-test.sh: the working set fit into RAM, the ZFS ARC or `STORAGE_CACHE_BYTES`) (`/api/test-runs`, `/api/time-series/all`, `/api/time-series/history`)
- `since` / `until` - Date (`YYYY-MM-DD`, `until` includes the whole day) or ISO datetime (`/api/test-runs`, `/api/time-series/all`; `/history` uses `start_date`/`end_date`)
- `run_uuid` - Comma-separated run UUIDs

### Pagination
- `limit` - Maximum number of results (default: 1000, max: 10000)
- `offset` - Number of results to skip
- `include_metadata=true` on `/api/test-runs` returns `{data, total, limit, offset, has_more}`; follow `has_more` to fetch all rows

## Response Formats

All responses are in JSON format. Successful responses include the requested data, while errors return:

```json
{
  "error": "Error message description"
}
```

## Performance Metrics

The API provides these key performance metrics:
- **IOPS** - Input/Output Operations Per Second
- **Bandwidth** - Data transfer rate in MB/s
- **Avg Latency** - Average latency in milliseconds
- **P95 Latency** - 95th percentile latency
- **P99 Latency** - 99th percentile latency

## Example Usage

### Get Latest Test Runs
```bash
curl -u admin:password http://localhost:8000/api/test-runs/?limit=10
```

### Import FIO Test Data
```bash
curl -u uploader:password -X POST \
  -F "file=@fio_results.json" \
  -F "hostname=server-01" \
  -F "protocol=Local" \
  http://localhost:8000/api/import/
```

### Get Performance Trends
```bash
curl -u admin:password \
  "http://localhost:8000/api/time-series/trends?hostname=server-01&metric=iops&days=30"
```

## Rate Limiting

Currently no rate limiting is implemented. For production deployments, consider adding rate limiting middleware.

## CORS

The API allows Cross-Origin Resource Sharing (CORS) from all origins. For production, configure appropriate CORS origins.

## Error Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Authentication required
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `422` - Validation error
- `500` - Internal server error

## Development

The API is built with:
- **FastAPI** - Modern Python web framework
- **SQLite** - Database backend
- **Pydantic** - Data validation
- **uvicorn** - ASGI server

For development, the API server can be started with:
```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Production Deployment

For production deployment:
1. Use environment variables for configuration
2. Enable HTTPS with proper certificates
3. Configure appropriate CORS origins
4. Implement rate limiting
5. Use a production ASGI server (gunicorn with uvicorn workers)
6. Set up proper logging and monitoring

## API Versioning

Current API version: 1.0.0

The API follows semantic versioning. Breaking changes will increment the major version number.