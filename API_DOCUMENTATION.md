# FIO Analyzer API Documentation

## Overview

The FIO Analyzer provides a comprehensive REST API for analyzing FIO (Flexible I/O Tester) benchmark results and monitoring storage performance over time. The API is built with FastAPI and provides automatic interactive documentation.

## API Documentation Access

The API provides three ways to access documentation:

1. **Swagger UI** (Interactive): http://localhost:8000/docs
2. **ReDoc** (Clean Documentation): http://localhost:8000/redoc
3. **OpenAPI JSON** (Machine-readable): http://localhost:8000/openapi.json

## Authentication

The API uses HTTP Basic Authentication with two user roles:
- **Admin**: Full access to all endpoints and user management
- **Uploader**: Can upload test data and view results

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

### Time Series Analytics
- `GET /api/time-series/servers` - Get server list with statistics
- `GET /api/time-series/all` - Get all historical data
- `GET /api/time-series/latest` - Get latest time series data
- `GET /api/time-series/history` - Get historical time series with filtering
- `GET /api/time-series/trends` - Analyze performance trends
- `PUT /api/time-series/bulk` - Bulk update time series data
- `DELETE /api/time-series/delete` - Delete time series data

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
- `syncs` - Sync flags (0=async, 1=sync)
- `directs` - Direct I/O flags (0=buffered, 1=direct)

### Pagination
- `limit` - Maximum number of results (default: 1000)
- `offset` - Number of results to skip

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