# API Contracts: Vue.js Frontend Dashboard

## Overview
Frontend-backend API contracts for the FIO Analyzer dashboard, defining request/response schemas and expected behaviors.

## Authentication Endpoints

### Login
**Endpoint**: `POST /api/auth/login` (if exists) or HTTP Basic Auth
**Purpose**: Authenticate user and establish session
**Request**: Basic Auth headers or JSON credentials
**Response**:
```json
{
  "user": {
    "username": "admin",
    "role": "admin" | "uploader"
  },
  "token": "optional_jwt_token",
  "expires_at": "2025-09-24T20:00:00Z"
}
```
**Error Cases**:
- `401`: Invalid credentials
- `429`: Too many attempts

### Logout
**Endpoint**: `POST /api/auth/logout` (if exists)
**Purpose**: Invalidate session
**Request**: Current auth headers
**Response**: `204 No Content`

## Core Data Endpoints

### Get Test Runs
**Endpoint**: `GET /api/test-runs/`
**Purpose**: Retrieve filtered test run data
**Query Parameters**:
- `hostnames`: Comma-separated hostnames
- `drive_types`: Comma-separated drive types
- `drive_models`: Comma-separated drive models
- `protocols`: Comma-separated protocols
- `patterns`: Comma-separated I/O patterns
- `block_sizes`: Comma-separated block sizes
- `syncs`: Comma-separated sync values (0,1)
- `queue_depths`: Comma-separated queue depths
- `directs`: Comma-separated direct values (0,1)
- `num_jobs`: Comma-separated job counts
- `test_sizes`: Comma-separated test sizes
- `durations`: Comma-separated durations
- `limit`: Maximum results (default 1000, max 10000)
- `offset`: Pagination offset (default 0)

**Response**:
```json
[
  {
    "id": 1,
    "timestamp": "2025-06-31T20:00:00",
    "hostname": "server-01",
    "drive_model": "Samsung SSD 980 PRO",
    "drive_type": "NVMe",
    "test_name": "random_read_4k",
    "description": "4K random read test",
    "block_size": "4K",
    "read_write_pattern": "randread",
    "queue_depth": 32,
    "duration": 300,
    "num_jobs": 1,
    "direct": 1,
    "sync": 0,
    "test_size": "10G",
    "protocol": "Local",
    "iops": 125000.5,
    "avg_latency": 0.256,
    "bandwidth": 488.28,
    "p95_latency": 0.512,
    "p99_latency": 1.024,
    "fio_version": "3.32",
    "job_runtime": 300000,
    "rwmixread": null,
    "total_ios_read": 37500000,
    "total_ios_write": 0,
    "usr_cpu": 15.2,
    "sys_cpu": 8.4,
    "output_file": "test_output.json",
    "is_latest": true
  }
]
```

**Error Cases**:
- `400`: Invalid filter parameters
- `401`: Authentication required
- `403`: Admin access required
- `500`: Server error

### Get Filter Options
**Endpoint**: `GET /api/filters/`
**Purpose**: Retrieve available filter values from current data
**Response**:
```json
{
  "drive_models": [
    "Samsung SSD 980 PRO",
    "WD Black SN850",
    "Intel Optane P5800X"
  ],
  "host_disk_combinations": [
    "server-01 - Local - Samsung SSD 980 PRO",
    "server-02 - iSCSI - WD Black SN850"
  ],
  "block_sizes": ["4K", "8K", "64K", "1M"],
  "patterns": ["randread", "randwrite", "read", "write"],
  "syncs": [0, 1],
  "queue_depths": [1, 8, 16, 32, 64],
  "directs": [0, 1],
  "num_jobs": [1, 4, 8, 16],
  "test_sizes": ["1G", "10G", "100G"],
  "durations": [30, 60, 300, 600],
  "hostnames": ["server-01", "server-02", "server-03"],
  "protocols": ["Local", "iSCSI", "NFS"],
  "drive_types": ["NVMe", "SATA", "SAS"]
}
```

**Error Cases**:
- `401`: Authentication required
- `403`: Admin access required
- `500`: Server error

### Get Single Test Run
**Endpoint**: `GET /api/test-runs/{test_run_id}`
**Purpose**: Retrieve detailed information for specific test run
**Response**: Single TestRun object (same schema as array item above)
**Error Cases**:
- `404`: Test run not found
- `401`: Authentication required
- `403`: Admin access required

### Get Performance Data
**Endpoint**: `GET /api/test-runs/performance-data?test_run_ids=1,2,3`
**Purpose**: Retrieve performance metrics for specific test runs
**Response**:
```json
[
  {
    "id": 1,
    "drive_model": "Samsung SSD 980 PRO",
    "drive_type": "NVMe",
    "test_name": "random_read_4k",
    "block_size": "4K",
    "read_write_pattern": "randread",
    "timestamp": "2025-06-31T20:00:00",
    "hostname": "server-01",
    "metrics": {
      "iops": {"value": 125000.5, "unit": "IOPS"},
      "avg_latency": {"value": 0.256, "unit": "ms"},
      "bandwidth": {"value": 488.28, "unit": "MB/s"},
      "p95_latency": {"value": 0.512, "unit": "ms"},
      "p99_latency": {"value": 1.024, "unit": "ms"}
    }
  }
]
```

## Health Check Endpoints

### API Health
**Endpoint**: `GET /health`
**Purpose**: Check API service health and status
**Response**:
```json
{
  "status": "OK",
  "timestamp": "2025-06-31T20:00:00Z",
  "version": "1.0.0"
}
```

### API Information
**Endpoint**: `GET /api/info`
**Purpose**: Get API metadata and capabilities
**Response**:
```json
{
  "name": "FIO Analyzer API",
  "version": "1.0.0",
  "description": "API for FIO performance analysis and monitoring",
  "endpoints": 20,
  "documentation": "/docs",
  "redoc_documentation": "/redoc",
  "openapi_schema": "/openapi.json",
  "features": [
    "FIO benchmark data import",
    "Performance metrics analysis",
    "User management and authentication"
  ],
  "supported_formats": ["JSON"],
  "authentication": "HTTP Basic Auth"
}
```

## User Management Endpoints (Admin Only)

### List Users
**Endpoint**: `GET /api/users/`
**Purpose**: Retrieve all user accounts
**Response**:
```json
[
  {
    "username": "admin",
    "role": "admin",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login": "2025-09-24T19:30:00Z"
  },
  {
    "username": "uploader",
    "role": "uploader",
    "created_at": "2025-01-15T00:00:00Z",
    "last_login": "2025-09-24T18:45:00Z"
  }
]
```

**Error Cases**:
- `401`: Authentication required
- `403`: Admin access required

### Create User
**Endpoint**: `POST /api/users/`
**Purpose**: Create new user account
**Request**:
```json
{
  "username": "newuser",
  "password": "securepassword",
  "role": "uploader"
}
```
**Response**:
```json
{
  "message": "User created successfully",
  "user": {
    "username": "newuser",
    "role": "uploader",
    "created_at": "2025-09-24T20:00:00Z"
  }
}
```

### Update User
**Endpoint**: `PUT /api/users/{username}`
**Request**:
```json
{
  "role": "admin",
  "password": "newpassword"
}
```
**Response**:
```json
{
  "message": "User updated successfully"
}
```

### Delete User
**Endpoint**: `DELETE /api/users/{username}`
**Response**:
```json
{
  "message": "User deleted successfully"
}
```

## Data Upload Endpoints

### Upload Test Data
**Endpoint**: `POST /api/import`
**Purpose**: Upload FIO test results
**Request**: Multipart form data or JSON
**Response**:
```json
{
  "message": "Test data imported successfully",
  "imported": 5,
  "failed": 0,
  "test_run_ids": [101, 102, 103, 104, 105]
}
```

**Error Cases**:
- `400`: Invalid file format or data
- `401`: Authentication required
- `403`: Upload permission required
- `413`: File too large
- `500`: Server error during processing

## Error Response Format

All endpoints use consistent error response format:
```json
{
  "error": "Human-readable error message",
  "request_id": "uuid-for-tracking",
  "details": {
    "field": "validation error details if applicable"
  }
}
```

## HTTP Status Codes

### Success Codes
- `200`: Successful GET, PUT requests
- `201`: Successful POST (resource created)
- `204`: Successful DELETE (no content)

### Client Error Codes
- `400`: Bad Request - Invalid parameters or data
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Resource already exists
- `413`: Payload Too Large - File size exceeded
- `422`: Unprocessable Entity - Validation failed
- `429`: Too Many Requests - Rate limit exceeded

### Server Error Codes
- `500`: Internal Server Error - Unexpected server error
- `502`: Bad Gateway - Upstream service error
- `503`: Service Unavailable - Temporary service outage
- `504`: Gateway Timeout - Upstream service timeout

## Request/Response Headers

### Standard Headers
**Request Headers**:
- `Authorization`: `Basic <base64(username:password)>`
- `Content-Type`: `application/json` or `multipart/form-data`
- `Accept`: `application/json`

**Response Headers**:
- `Content-Type`: `application/json`
- `X-Request-ID`: Unique request identifier
- `X-RateLimit-Remaining`: Remaining requests in window
- `Access-Control-Allow-Origin`: CORS header

### Authentication Headers
- All endpoints except `/health` require authentication
- Admin endpoints require admin role verification
- Upload endpoints require upload permission

## Rate Limiting

### Limits by Endpoint Category
- **Authentication**: 10 requests per minute per IP
- **Data retrieval**: 100 requests per minute per user
- **Filter options**: 60 requests per minute per user
- **Upload**: 10 requests per minute per user
- **User management**: 30 requests per minute per admin

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Caching Strategy

### Client-Side Caching
- **Filter options**: Cache for 5 minutes
- **Test run data**: Cache for 2 minutes
- **User list**: Cache for 10 minutes
- **API info**: Cache for 1 hour

### Cache Headers
```
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: Tue, 24 Sep 2025 20:00:00 GMT
```

## Data Freshness & Consistency

### Data Updates
- New test uploads invalidate relevant caches
- Filter options refresh when new data added
- Real-time updates not required (polling acceptable)
- Eventual consistency acceptable for statistics

### Polling Strategy
- Dashboard stats: Poll every 30 seconds when active
- Filter options: Poll every 5 minutes
- Test run data: Poll only on user action
- System status: Poll every 10 seconds

## Error Handling Strategy

### Network Errors
- Connection timeout: Retry with exponential backoff
- Network unreachable: Show offline indicator
- DNS resolution: Show connectivity error

### API Errors
- `401`/`403`: Redirect to login or show access denied
- `404`: Show "not found" message with suggested actions
- `500`: Show generic error with retry option
- `429`: Show rate limit warning with retry timer

### Data Validation Errors
- Client-side validation first (immediate feedback)
- Server validation errors shown contextually
- Malformed responses logged and gracefully handled

## Testing Contracts

### Contract Test Structure
```typescript
describe('API Contract: /api/test-runs', () => {
  it('should return array of TestRun objects', async () => {
    const response = await api.getTestRuns();
    expect(response).toBeArray();
    expect(response[0]).toMatchSchema(TestRunSchema);
  });

  it('should handle filter parameters correctly', async () => {
    const response = await api.getTestRuns({
      hostnames: 'server-01,server-02',
      drive_types: 'NVMe'
    });
    expect(response.every(run =>
      ['server-01', 'server-02'].includes(run.hostname) &&
      run.drive_type === 'NVMe'
    )).toBe(true);
  });

  it('should return 401 for unauthenticated requests', async () => {
    await expect(api.getTestRuns({ noAuth: true }))
      .rejects.toThrow('401');
  });
});
```