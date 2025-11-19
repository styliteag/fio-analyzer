"""
Time series API router
"""

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from auth.middleware import User, require_admin
from database.connection import get_db
from database.models import TrendData
from utils.logging import log_error, log_info

router = APIRouter()


@router.get(
    "/servers",
    summary="Get Server List",
    description="Retrieve list of servers with aggregated test run statistics",
    response_description="List of servers with test data summaries",
    responses={
        200: {
            "description": "Server list retrieved successfully",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "hostname": "server-01",
                            "protocol": "Local",
                            "drive_model": "Samsung SSD 980 PRO",
                            "test_count": 15,
                            "last_test_time": "2025-06-31T20:00:00",
                            "first_test_time": "2024-01-15T10:30:00",
                        },
                        {
                            "hostname": "server-02",
                            "protocol": "iSCSI",
                            "drive_model": "WD Black SN850",
                            "test_count": 8,
                            "last_test_time": "2025-06-30T15:45:00",
                            "first_test_time": "2024-03-20T09:15:00",
                        },
                    ]
                }
            },
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/servers/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_servers(
    request: Request,
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve list of servers with aggregated test run statistics.

    This endpoint provides a summary view of all servers that have
    submitted test data, including configuration counts and test history.

    **Authentication Required:** Admin access

    **Returned Data:**
    - **hostname**: Server identifier
    - **protocol**: Storage protocol (Local, iSCSI, NFS, etc.)
    - **drive_model**: Drive model identifier
    - **test_count**: Number of test runs for this hostname-protocol-drive_model combination
    - **last_test_time**: Most recent test timestamp
    - **first_test_time**: Oldest test timestamp

    **Use Cases:**
    - Server inventory and monitoring
    - Test activity overview
    - Historical data availability check
    - Performance dashboard summaries
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        # Get server information grouped by hostname, protocol, and drive_model
        # This matches the frontend ServerInfo interface which expects protocol and drive_model
        cursor.execute(
            """
            SELECT
                hostname,
                protocol,
                drive_model,
                COUNT(*) AS test_count,
                MAX(timestamp) AS last_test_time,
                MIN(timestamp) AS first_test_time
            FROM test_runs_all
            WHERE hostname IS NOT NULL
              AND protocol IS NOT NULL
              AND drive_model IS NOT NULL
            GROUP BY
                hostname,
                protocol,
                drive_model
            ORDER BY last_test_time DESC
        """
        )

        servers = []
        for row in cursor.fetchall():
            servers.append(
                {
                    "hostname": row[0],
                    "protocol": row[1],
                    "drive_model": row[2],
                    "test_count": row[3],
                    "last_test_time": row[4],
                    "first_test_time": row[5],
                }
            )

        log_info(
            "Servers retrieved successfully",
            {"request_id": request_id, "server_count": len(servers)},
        )

        return servers

    except Exception as e:
        log_error("Error retrieving servers", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve servers")


@router.get(
    "/all",
    summary="Get All Historical Data",
    description="Retrieve complete historical time series data with comprehensive filtering",
    response_description="Complete historical test run data matching filter criteria",
    responses={
        200: {
            "description": "Historical data retrieved successfully",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "timestamp": "2025-06-31T20:00:00",
                            "hostname": "server-01",
                            "drive_model": "Samsung SSD 980 PRO",
                            "drive_type": "NVMe",
                            "test_name": "random_read_4k",
                            "block_size": "4K",
                            "read_write_pattern": "randread",
                            "queue_depth": 32,
                            "protocol": "Local",
                            "iops": 125000.5,
                            "avg_latency": 0.256,
                            "bandwidth": 488.28,
                            "p70_latency": 0.384,
                            "p90_latency": 0.448,
                            "p95_latency": 0.512,
                            "p99_latency": 1.024,
                        }
                    ]
                }
            },
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/all/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_all_time_series(
    request: Request,
    hostnames: Optional[str] = Query(
        None,
        description="Comma-separated list of hostnames to include",
        example="server-01,server-02",
    ),
    protocols: Optional[str] = Query(
        None,
        description="Comma-separated list of storage protocols to include",
        example="Local,iSCSI,NFS",
    ),
    drive_types: Optional[str] = Query(
        None,
        description="Comma-separated list of drive technology types",
        example="NVMe,SATA,SAS",
    ),
    drive_models: Optional[str] = Query(
        None,
        description="Comma-separated list of specific drive models",
        example="Samsung SSD 980 PRO,WD Black SN850",
    ),
    patterns: Optional[str] = Query(
        None,
        description="Comma-separated list of I/O access patterns",
        example="randread,randwrite,read,write",
    ),
    block_sizes: Optional[str] = Query(
        None,
        description="Comma-separated list of I/O block sizes",
        example="4K,8K,64K,1M",
    ),
    syncs: Optional[str] = Query(
        None,
        description="Comma-separated list of sync flags (0=async, 1=sync)",
        example="0,1",
    ),
    queue_depths: Optional[str] = Query(
        None,
        description="Comma-separated list of I/O queue depths",
        example="1,8,32,64",
    ),
    directs: Optional[str] = Query(
        None,
        description="Comma-separated list of direct I/O flags (0=buffered, 1=direct)",
        example="0,1",
    ),
    num_jobs: Optional[str] = Query(
        None,
        description="Comma-separated list of concurrent job counts",
        example="1,4,8,16",
    ),
    test_sizes: Optional[str] = Query(
        None,
        description="Comma-separated list of test data sizes",
        example="1G,10G,100G",
    ),
    durations: Optional[str] = Query(
        None,
        description="Comma-separated list of test durations in seconds",
        example="30,60,300,600",
    ),
    limit: int = Query(
        1000,
        ge=1,
        le=10000,
        description="Maximum number of records to return",
        example=500,
    ),
    offset: int = Query(0, ge=0, description="Number of records to skip for pagination", example=0),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve complete historical time series data with advanced filtering.

    This endpoint provides access to the full historical dataset (test_runs_all table)
    with comprehensive filtering capabilities. Ideal for trend analysis, performance
    comparisons, and historical reporting.

    **Authentication Required:** Admin access

    **Data Source:** Complete historical records (test_runs_all table)

    **Filtering Options:**
    All filters support multiple values using comma-separated lists.
    Combine filters to create precise queries (e.g., specific drive models
    on certain hosts with particular I/O patterns).

    **Use Cases:**
    - Long-term performance trend analysis
    - Cross-system performance comparison
    - Historical performance regression detection
    - Data export for external analysis tools
    - Performance baseline establishment

    **Pagination:**
    Use limit and offset parameters for large datasets.
    Maximum limit is 10,000 records per request.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        # Build WHERE conditions
        where_conditions = []
        params = []

        if hostnames:
            hostname_list = [h.strip() for h in hostnames.split(",")]
            placeholders = ",".join(["?" for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)

        if protocols:
            protocol_list = [p.strip() for p in protocols.split(",")]
            placeholders = ",".join(["?" for _ in protocol_list])
            where_conditions.append(f"protocol IN ({placeholders})")
            params.extend(protocol_list)

        if drive_types:
            drive_type_list = [d.strip() for d in drive_types.split(",")]
            placeholders = ",".join(["?" for _ in drive_type_list])
            where_conditions.append(f"drive_type IN ({placeholders})")
            params.extend(drive_type_list)

        if drive_models:
            drive_model_list = [d.strip() for d in drive_models.split(",")]
            placeholders = ",".join(["?" for _ in drive_model_list])
            where_conditions.append(f"drive_model IN ({placeholders})")
            params.extend(drive_model_list)

        if patterns:
            pattern_list = [p.strip() for p in patterns.split(",")]
            placeholders = ",".join(["?" for _ in pattern_list])
            where_conditions.append(f"read_write_pattern IN ({placeholders})")
            params.extend(pattern_list)

        if block_sizes:
            block_size_list = [b.strip() for b in block_sizes.split(",")]
            placeholders = ",".join(["?" for _ in block_size_list])
            where_conditions.append(f"block_size IN ({placeholders})")
            params.extend(block_size_list)

        if syncs:
            sync_list = [int(s.strip()) for s in syncs.split(",")]
            placeholders = ",".join(["?" for _ in sync_list])
            where_conditions.append(f"sync IN ({placeholders})")
            params.extend(sync_list)

        if queue_depths:
            queue_depth_list = [int(q.strip()) for q in queue_depths.split(",")]
            placeholders = ",".join(["?" for _ in queue_depth_list])
            where_conditions.append(f"queue_depth IN ({placeholders})")
            params.extend(queue_depth_list)

        if directs:
            direct_list = [int(d.strip()) for d in directs.split(",")]
            placeholders = ",".join(["?" for _ in direct_list])
            where_conditions.append(f"direct IN ({placeholders})")
            params.extend(direct_list)

        if num_jobs:
            num_jobs_list = [int(n.strip()) for n in num_jobs.split(",")]
            placeholders = ",".join(["?" for _ in num_jobs_list])
            where_conditions.append(f"num_jobs IN ({placeholders})")
            params.extend(num_jobs_list)

        if test_sizes:
            test_size_list = [t.strip() for t in test_sizes.split(",")]
            placeholders = ",".join(["?" for _ in test_size_list])
            where_conditions.append(f"test_size IN ({placeholders})")
            params.extend(test_size_list)

        if durations:
            duration_list = [int(d.strip()) for d in durations.split(",")]
            placeholders = ",".join(["?" for _ in duration_list])
            where_conditions.append(f"duration IN ({placeholders})")
            params.extend(duration_list)

        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"

        # Get all historical data
        cursor.execute(
            f"""
            SELECT id, timestamp, drive_model, drive_type, test_name, description,
                   block_size, read_write_pattern, queue_depth, duration,
                   fio_version, job_runtime, rwmixread, total_ios_read,
                   total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                   output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                   avg_latency, bandwidth, iops, p70_latency, p90_latency, p95_latency, p99_latency
            FROM test_runs_all
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """,
            params + [limit, offset],
        )

        # Convert to dictionaries
        results = []
        for row in cursor.fetchall():
            test_run_data = dict(row)
            test_run_data["block_size"] = str(test_run_data["block_size"])  # Ensure string
            results.append(test_run_data)

        log_info(
            "All historical time series data retrieved successfully",
            {
                "request_id": request_id,
                "results_count": len(results),
                "filters_applied": {
                    "hostnames": hostnames,
                    "protocols": protocols,
                    "drive_types": drive_types,
                    "drive_models": drive_models,
                    "patterns": patterns,
                    "block_sizes": block_sizes,
                    "syncs": syncs,
                    "queue_depths": queue_depths,
                    "directs": directs,
                    "num_jobs": num_jobs,
                    "test_sizes": test_sizes,
                    "durations": durations,
                },
            },
        )

        return results

    except Exception as e:
        log_error("Error retrieving all time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve all time series data")


@router.get(
    "/latest",
    summary="Get Latest Time Series Data",
    description="Retrieve the most recent test data formatted for time series visualization",
    response_description="Latest test data formatted as time series points",
    responses={
        200: {
            "description": "Latest time series data retrieved successfully",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "timestamp": "2025-06-31T20:00:00",
                            "hostname": "server-01",
                            "protocol": "Local",
                            "drive_model": "Samsung SSD 980 PRO",
                            "drive_type": "NVMe",
                            "block_size": "4K",
                            "read_write_pattern": "randread",
                            "queue_depth": 32,
                            "metric_type": "iops",
                            "value": 125000.5,
                            "unit": "IOPS",
                        },
                        {
                            "timestamp": "2025-06-31T20:00:00",
                            "hostname": "server-01",
                            "protocol": "Local",
                            "drive_model": "Samsung SSD 980 PRO",
                            "drive_type": "NVMe",
                            "block_size": "4K",
                            "read_write_pattern": "randread",
                            "queue_depth": 32,
                            "metric_type": "avg_latency",
                            "value": 0.256,
                            "unit": "ms",
                        },
                    ]
                }
            },
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/latest/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_latest_time_series(
    request: Request,
    hostnames: Optional[str] = Query(
        None,
        description="Comma-separated list of hostnames to include in results",
        example="server-01,server-02",
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="Maximum number of test runs to process (before metric expansion)",
        example=50,
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve latest test data formatted for time series visualization.

    This endpoint returns the most recent test results formatted as individual
    time series data points. Each performance metric becomes a separate data point
    with appropriate units and labels.

    **Authentication Required:** Admin access

    **Data Source:** Latest test results (test_runs table)

    **Data Format:**
    Each test run is expanded into multiple time series points - one for each
    performance metric (IOPS, latency, bandwidth, etc.). This format is
    optimized for time series charting libraries.

    **Metrics Included:**
    - **iops**: Input/Output Operations Per Second
    - **avg_latency**: Average response time in milliseconds
    - **bandwidth**: Data transfer rate in MB/s
    - **p70_latency**: 70th percentile latency in milliseconds
    - **p90_latency**: 90th percentile latency in milliseconds
    - **p95_latency**: 95th percentile latency in milliseconds
    - **p99_latency**: 99th percentile latency in milliseconds

    **Use Cases:**
    - Real-time performance dashboards
    - Current system status monitoring
    - Latest performance metric visualization
    - Time series chart data feeding

    **Note:** The limit parameter controls the number of test runs processed,
    but each test run generates multiple data points (one per metric).
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        # Build query
        where_conditions = ["1=1"]
        params = []

        if hostnames:
            hostname_list = [h.strip() for h in hostnames.split(",")]
            placeholders = ",".join(["?" for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)

        where_clause = " AND ".join(where_conditions)

        # Get latest data
        cursor.execute(
            f"""
            SELECT
                timestamp, hostname, protocol, drive_model, drive_type,
                block_size, read_write_pattern, queue_depth,
                iops, avg_latency, bandwidth, p70_latency, p90_latency, p95_latency, p99_latency
            FROM test_runs
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ?
        """,
            params + [limit],
        )

        # Flatten metrics into separate TimeSeriesDataPoint objects
        results = []
        metrics_mapping = [
            ("iops", 8, "IOPS"),
            ("avg_latency", 9, "ms"),
            ("bandwidth", 10, "MB/s"),
            ("p70_latency", 11, "ms"),
            ("p90_latency", 12, "ms"),
            ("p95_latency", 13, "ms"),
            ("p99_latency", 14, "ms"),
        ]

        for row in cursor.fetchall():
            base_data = {
                "timestamp": row[0],
                "hostname": row[1],
                "protocol": row[2],
                "drive_model": row[3],
                "drive_type": row[4],
                "block_size": row[5],
                "read_write_pattern": row[6],
                "queue_depth": row[7],
            }

            # Create separate time series point for each metric
            for metric_type, col_idx, unit in metrics_mapping:
                if row[col_idx] is not None:
                    results.append(
                        {
                            **base_data,
                            "metric_type": metric_type,
                            "value": row[col_idx],
                            "unit": unit,
                        }
                    )

        log_info(
            "Latest time series data retrieved successfully",
            {"request_id": request_id, "results_count": len(results)},
        )

        # Frontend expects direct array, not wrapped object
        return results

    except Exception as e:
        log_error("Error retrieving latest time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve latest time series data")


@router.get(
    "/history",
    summary="Get Historical Time Series",
    description="Retrieve historical performance data with detailed filtering and date range selection",
    response_description="Historical time series data matching the specified criteria",
    responses={
        200: {
            "description": "Historical time series data retrieved successfully",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "test_run_id": 1,
                            "timestamp": "2025-06-31T20:00:00",
                            "hostname": "server-01",
                            "protocol": "Local",
                            "drive_model": "Samsung SSD 980 PRO",
                            "block_size": "4K",
                            "read_write_pattern": "randread",
                            "queue_depth": 32,
                            "iops": 125000.5,
                            "avg_latency": 0.256,
                            "bandwidth": 488.28,
                            "p70_latency": 0.384,
                            "p90_latency": 0.448,
                            "p95_latency": 0.512,
                            "p99_latency": 1.024,
                        }
                    ]
                }
            },
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/history/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_historical_time_series(
    request: Request,
    hostname: Optional[str] = Query(
        None,
        description="Single hostname to filter by (alternative to hostnames parameter)",
        example="server-01",
    ),
    hostnames: Optional[str] = Query(
        None,
        description="Comma-separated list of hostnames (alternative to hostname parameter)",
        example="server-01,server-02",
    ),
    protocol: Optional[str] = Query(None, description="Storage protocol to filter by", example="Local"),
    drive_model: Optional[str] = Query(
        None,
        description="Specific drive model to filter by",
        example="Samsung SSD 980 PRO",
    ),
    drive_type: Optional[str] = Query(None, description="Drive technology type to filter by", example="NVMe"),
    block_size: Optional[str] = Query(None, description="I/O block size to filter by", example="4K"),
    read_write_pattern: Optional[str] = Query(None, description="I/O access pattern to filter by", example="randread"),
    queue_depth: Optional[int] = Query(None, description="I/O queue depth to filter by", example=32),
    metric_type: Optional[str] = Query(
        None,
        description="Filter to show only records with non-null values for this metric",
        example="iops",
    ),
    days: Optional[int] = Query(
        30,
        description="Number of days to look back from current time (ignored if start_date/end_date provided)",
        example=30,
        ge=1,
        le=365,
    ),
    test_size: Optional[str] = Query(None, description="Test data size to filter by", example="10G"),
    sync: Optional[int] = Query(None, description="Sync flag to filter by (0=async, 1=sync)", example=0),
    direct: Optional[int] = Query(
        None,
        description="Direct I/O flag to filter by (0=buffered, 1=direct)",
        example=1,
    ),
    num_jobs: Optional[int] = Query(None, description="Number of concurrent jobs to filter by", example=4),
    duration: Optional[int] = Query(None, description="Test duration in seconds to filter by", example=300),
    start_date: Optional[str] = Query(
        None,
        description="Start date for data range in ISO format (overrides days parameter)",
        example="2025-01-01T00:00:00",
    ),
    end_date: Optional[str] = Query(
        None,
        description="End date for data range in ISO format (overrides days parameter)",
        example="2025-06-31T23:59:59",
    ),
    limit: int = Query(
        10000,
        ge=1,
        le=50000,
        description="Maximum number of records to return",
        example=1000,
    ),
    offset: int = Query(0, ge=0, description="Number of records to skip for pagination", example=0),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve historical performance data with comprehensive filtering options.

    This endpoint provides flexible access to historical test data with extensive
    filtering capabilities and date range selection. Perfect for trend analysis,
    performance comparisons, and data visualization.

    **Authentication Required:** Admin access

    **Data Source:** Complete historical records (test_runs_all table)

    **Date Range Options:**
    1. **Relative**: Use `days` parameter to look back from current time
    2. **Absolute**: Use `start_date` and `end_date` for specific ranges
    3. **Open-ended**: Use only `start_date` or only `end_date`

    **Hostname Filtering:**
    Use either `hostname` (single) or `hostnames` (comma-separated list).
    The `hostnames` parameter takes precedence if both are provided.

    **Metric Filtering:**
    The `metric_type` parameter filters results to only include records
    where the specified metric has a non-null value. Useful for ensuring
    complete data for specific analysis.

    **Use Cases:**
    - Performance trend analysis over time
    - Before/after performance comparisons
    - System performance regression detection
    - Custom date range reporting
    - Workload-specific performance analysis

    **Performance Tips:**
    - Use specific filters to reduce dataset size
    - Limit date ranges for faster queries
    - Use metric_type filter to ensure data completeness
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        # Build query
        where_conditions = ["1=1"]
        params = []

        # Handle both hostname (singular) and hostnames (plural) for compatibility
        if hostname or hostnames:
            hostname_param = hostname if hostname else hostnames
            hostname_list = [h.strip() for h in hostname_param.split(",")]
            placeholders = ",".join(["?" for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)

        # Add all filter parameters
        if protocol:
            where_conditions.append("protocol = ?")
            params.append(protocol)

        if drive_model:
            where_conditions.append("drive_model = ?")
            params.append(drive_model)

        if drive_type:
            where_conditions.append("drive_type = ?")
            params.append(drive_type)

        if block_size:
            where_conditions.append("block_size = ?")
            params.append(block_size)

        if read_write_pattern:
            where_conditions.append("read_write_pattern = ?")
            params.append(read_write_pattern)

        if queue_depth is not None:
            where_conditions.append("queue_depth = ?")
            params.append(queue_depth)

        if test_size:
            where_conditions.append("test_size = ?")
            params.append(test_size)

        if sync is not None:
            where_conditions.append("sync = ?")
            params.append(sync)

        if direct is not None:
            where_conditions.append("direct = ?")
            params.append(direct)

        if num_jobs is not None:
            where_conditions.append("num_jobs = ?")
            params.append(num_jobs)

        if duration is not None:
            where_conditions.append("duration = ?")
            params.append(duration)

        # Handle days parameter (takes precedence over start_date/end_date)
        if days is not None and not start_date and not end_date:
            from datetime import datetime, timedelta, timezone

            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=days)
            where_conditions.append("timestamp >= ?")
            where_conditions.append("timestamp <= ?")
            params.append(start_time.isoformat())
            params.append(end_time.isoformat())
        else:
            # Use explicit start/end dates if provided
            if start_date:
                where_conditions.append("timestamp >= ?")
                params.append(start_date)

            if end_date:
                where_conditions.append("timestamp <= ?")
                params.append(end_date)

        where_clause = " AND ".join(where_conditions)

        # Get total count first for pagination metadata
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM test_runs_all
            WHERE {where_clause}
        """,
            params,
        )
        total_count = cursor.fetchone()[0]

        # Get historical data with LIMIT and OFFSET
        cursor.execute(
            f"""
            SELECT
                id, timestamp, hostname, protocol, drive_model, drive_type,
                block_size, read_write_pattern, queue_depth,
                iops, avg_latency, bandwidth, p70_latency, p90_latency, p95_latency, p99_latency,
                config_uuid, run_uuid
            FROM test_runs_all
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """,
            params + [limit, offset],
        )

        results = []
        for row in cursor.fetchall():
            # Build the result object with all metrics (matching Node.js structure)
            result = {
                "test_run_id": row[0],
                "timestamp": row[1],
                "hostname": row[2],
                "protocol": row[3],
                "drive_model": row[4],
                "block_size": row[6],
                "read_write_pattern": row[7],
                "queue_depth": row[8],
                "avg_latency": row[10],
                "bandwidth": row[11],
                "iops": row[9],
                "p70_latency": row[12],
                "p90_latency": row[13],
                "p95_latency": row[14],
                "p99_latency": row[15],
                "config_uuid": row[16],
                "run_uuid": row[17],
            }

            # If metric_type is specified, filter results to only include records with that metric value
            if metric_type:
                metric_value = result.get(metric_type)
                if metric_value is None:
                    continue  # Skip records without the requested metric

            results.append(result)

        # Prepare paginated response
        has_more = len(results) == limit and (offset + len(results)) < total_count
        response = {
            "data": results,
            "pagination": {
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
                "returned_count": len(results),
                "has_more": has_more,
            },
        }

        log_info(
            "Historical time series data retrieved successfully",
            {
                "request_id": request_id,
                "results_count": len(results),
                "total_count": total_count,
                "has_more": has_more,
                "date_range": {"start": start_date, "end": end_date},
            },
        )

        return response

    except Exception as e:
        log_error(
            "Error retrieving historical time series data",
            e,
            {"request_id": request_id},
        )
        raise HTTPException(status_code=500, detail="Failed to retrieve historical time series data")


@router.get(
    "/trends",
    summary="Get Performance Trends",
    description="Analyze performance trends for a specific host and metric over time",
    response_description="Trend analysis data with statistical insights",
    responses={
        200: {
            "description": "Trend analysis completed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "data": [
                            {
                                "timestamp": "2025-06-01T10:00:00",
                                "block_size": "4K",
                                "read_write_pattern": "randread",
                                "queue_depth": 32,
                                "value": 120000.0,
                                "unit": "IOPS",
                                "moving_avg": 118500.0,
                                "percent_change": "+2.5%",
                            }
                        ],
                        "trend_analysis": {
                            "total_points": 30,
                            "min_value": 115000.0,
                            "max_value": 125000.0,
                            "avg_value": 120500.0,
                            "first_value": 118000.0,
                            "last_value": 122000.0,
                            "overall_change": "+3.4%",
                        },
                    }
                }
            },
        },
        400: {"description": "Invalid hostname or metric parameter"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "No data found for the specified parameters"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/trends/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_trends(
    request: Request,
    hostname: str = Query(
        ...,
        description="Hostname to analyze for performance trends",
        example="server-01",
    ),
    metric: str = Query(
        "iops",
        description="Performance metric to analyze",
        example="iops",
        regex="^(iops|avg_latency|bandwidth|p70_latency|p90_latency|p95_latency|p99_latency)$",
    ),
    days: int = Query(
        30,
        ge=1,
        le=365,
        description="Number of days to analyze for trend calculation",
        example=30,
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Analyze performance trends for a specific host and metric over time.

    This endpoint provides statistical trend analysis including moving averages,
    percentage changes, and summary statistics for a given performance metric
    on a specific host.

    **Authentication Required:** Admin access

    **Available Metrics:**
    - **iops**: Input/Output Operations Per Second
    - **avg_latency**: Average response time in milliseconds
    - **bandwidth**: Data transfer rate in MB/s
    - **p70_latency**: 70th percentile latency
    - **p90_latency**: 90th percentile latency
    - **p95_latency**: 95th percentile latency
    - **p99_latency**: 99th percentile latency

    **Analysis Features:**
    - **Moving Average**: 3-point moving average calculation
    - **Percentage Change**: Period-over-period change calculation
    - **Statistical Summary**: Min, max, average, and overall change
    - **Temporal Ordering**: Data sorted chronologically

    **Use Cases:**
    - Performance degradation detection
    - Capacity planning and forecasting
    - System optimization validation
    - Performance baseline establishment
    - Long-term trend monitoring

    **Data Requirements:**
    The analysis requires at least 3 data points for meaningful
    trend calculation. If insufficient data is available,
    a message will be returned instead of trend data.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)

        # Get trend data
        cursor.execute(
            f"""
            SELECT
                timestamp, block_size, read_write_pattern, queue_depth, {metric}
            FROM test_runs_all
            WHERE hostname = ? AND timestamp >= ? AND timestamp <= ?
            AND {metric} IS NOT NULL
            ORDER BY timestamp ASC
        """,
            (hostname, start_date.isoformat(), end_date.isoformat()),
        )

        rows = cursor.fetchall()

        if not rows:
            return {
                "data": [],
                "trend_analysis": {"message": "No data found for the specified period"},
            }

        # Calculate trends
        trends = []
        prev_value = None

        for i, row in enumerate(rows):
            timestamp, block_size, pattern, queue_depth, value = row

            # Calculate percentage change
            percent_change = None
            if prev_value is not None and prev_value != 0:
                percent_change = f"{((value - prev_value) / prev_value) * 100:.2f}%"

            # Calculate moving average (3-point)
            moving_avg = None
            if i >= 2:
                window_values = [rows[j][4] for j in range(i - 2, i + 1)]
                moving_avg = sum(window_values) / len(window_values)

            trends.append(
                TrendData(
                    timestamp=timestamp,
                    block_size=block_size,
                    read_write_pattern=pattern,
                    queue_depth=queue_depth,
                    value=value,
                    unit=get_metric_unit(metric),
                    moving_avg=moving_avg,
                    percent_change=percent_change,
                )
            )

            prev_value = value

        # Calculate trend analysis
        values = [row[4] for row in rows]
        trend_analysis = {
            "total_points": len(values),
            "min_value": min(values),
            "max_value": max(values),
            "avg_value": sum(values) / len(values),
            "first_value": values[0],
            "last_value": values[-1],
            "overall_change": (f"{((values[-1] - values[0]) / values[0]) * 100:.2f}%" if values[0] != 0 else "N/A"),
        }

        log_info(
            "Trend analysis completed successfully",
            {
                "request_id": request_id,
                "hostname": hostname,
                "metric": metric,
                "days": days,
                "data_points": len(trends),
            },
        )

        return {"data": trends, "trend_analysis": trend_analysis}

    except Exception as e:
        log_error("Error retrieving trend analysis", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve trend analysis")


@router.put(
    "/bulk",
    summary="Bulk Update Time Series Data",
    description="Update multiple historical test runs with new metadata",
    response_description="Bulk update operation results",
    responses={
        200: {
            "description": "Bulk update completed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Successfully updated 10 time-series test runs",
                        "updated": 10,
                        "failed": 0,
                    }
                }
            },
        },
        400: {"description": "Invalid request data, missing fields, or no valid updates"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error during update"},
    },
)
@router.put("/bulk/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def bulk_update_time_series(
    request: Request,
    bulk_request: dict = Body(
        ...,
        description="Bulk update request containing test run IDs and update fields",
        example={
            "testRunIds": [1, 2, 3, 15, 42],
            "updates": {
                "description": "Updated batch description",
                "hostname": "renamed-server",
            },
        },
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Update multiple historical test runs with new metadata in a single operation.

    This endpoint allows bulk updating of metadata fields across multiple
    historical test runs. Updates are applied to both current and historical
    data tables to maintain consistency.

    **Authentication Required:** Admin access

    **Request Format:**
    ```json
    {
        "testRunIds": [1, 2, 3],
        "updates": {
            "description": "New description",
            "hostname": "updated-hostname"
        }
    }
    ```

    **Updatable Fields:**
    - description: Test description or notes
    - test_name: Human-readable test name
    - hostname: Server hostname
    - protocol: Storage protocol
    - drive_type: Drive technology type
    - drive_model: Specific drive model

    **Transaction Safety:**
    All updates are performed within a database transaction.
    If any update fails, all changes are rolled back.

    **Use Cases:**
    - Batch hostname updates after server migrations
    - Standardizing test descriptions
    - Correcting metadata across multiple test runs
    - Mass updates for organizational changes
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Extract required fields
        test_run_ids = bulk_request.get("testRunIds")
        updates = bulk_request.get("updates")

        # Validate required fields
        if not test_run_ids or not isinstance(test_run_ids, list) or len(test_run_ids) == 0:
            raise HTTPException(
                status_code=400,
                detail="testRunIds array is required and must not be empty",
            )

        if not updates or not isinstance(updates, dict):
            raise HTTPException(status_code=400, detail="updates object is required")

        # Define allowed fields for validation
        allowed_fields = [
            "description",
            "test_name",
            "hostname",
            "protocol",
            "drive_type",
            "drive_model",
        ]
        submitted_fields = list(updates.keys())

        # Check for invalid fields
        invalid_fields = [field for field in submitted_fields if field not in allowed_fields]
        if invalid_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid fields: {', '.join(invalid_fields)}. Allowed fields: {', '.join(allowed_fields)}",
            )

        # Build dynamic SQL for only the fields being updated
        set_parts = []
        values = []

        if "description" in updates:
            set_parts.append("description = ?")
            values.append(updates["description"])
        if "test_name" in updates:
            set_parts.append("test_name = ?")
            values.append(updates["test_name"])
        if "hostname" in updates:
            set_parts.append("hostname = ?")
            values.append(updates["hostname"])
        if "protocol" in updates:
            set_parts.append("protocol = ?")
            values.append(updates["protocol"])
        if "drive_type" in updates:
            set_parts.append("drive_type = ?")
            values.append(updates["drive_type"])
        if "drive_model" in updates:
            set_parts.append("drive_model = ?")
            values.append(updates["drive_model"])

        if len(set_parts) == 0:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        # Create placeholders for WHERE IN clause
        placeholders = ",".join(["?" for _ in test_run_ids])
        where_values = [int(test_id) for test_id in test_run_ids]

        cursor = db.cursor()

        # Begin transaction
        cursor.execute("BEGIN TRANSACTION")

        try:
            # Update test_runs_all first
            update_all_query = f"""
                UPDATE test_runs_all
                SET {', '.join(set_parts)}
                WHERE id IN ({placeholders})
            """
            cursor.execute(update_all_query, values + where_values)
            updated_count_all = cursor.rowcount

            # Also update test_runs table to keep in sync
            update_runs_query = f"""
                UPDATE test_runs
                SET {', '.join(set_parts)}
                WHERE id IN ({placeholders})
            """
            cursor.execute(update_runs_query, values + where_values)
            updated_count_runs = cursor.rowcount

            # Commit transaction
            cursor.execute("COMMIT")

            total_updated = min(updated_count_all, updated_count_runs)
            failed_count = len(test_run_ids) - total_updated

            log_info(
                "Bulk time-series test run update completed",
                {
                    "request_id": request_id,
                    "user": user.username,
                    "requested_count": len(test_run_ids),
                    "updated_count": total_updated,
                    "failed_count": failed_count,
                    "updated_fields": submitted_fields,
                    "changes": updates,
                },
            )

            return {
                "message": f"Successfully updated {total_updated} time-series test runs",
                "updated": total_updated,
                "failed": failed_count,
            }

        except Exception as e:
            # Rollback on error
            cursor.execute("ROLLBACK")
            raise e

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error during bulk time-series update", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update time-series test runs")


@router.delete(
    "/delete",
    summary="Delete Time Series Data",
    description="Permanently delete multiple historical test runs",
    response_description="Deletion operation results",
    responses={
        200: {
            "description": "Deletion completed successfully",
            "content": {"application/json": {"example": {"deleted": 8, "notFound": 2}}},
        },
        400: {"description": "Invalid request data or missing test run IDs"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error during deletion"},
    },
)
@router.delete("/delete/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def delete_time_series(
    request: Request,
    delete_request: dict = Body(
        ...,
        description="Deletion request containing test run IDs to remove",
        example={"testRunIds": [1, 2, 3, 15, 42]},
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Permanently delete multiple historical test runs.

    This endpoint removes test runs from the historical data table
    (test_runs_all). This operation cannot be undone.

    **Authentication Required:** Admin access

    **Request Format:**
    ```json
    {
        "testRunIds": [1, 2, 3, 15, 42]
    }
    ```

    **Response Format:**
    ```json
    {
        "deleted": 8,
        "notFound": 2
    }
    ```

    **Operation Details:**
    - Only affects historical data (test_runs_all table)
    - Returns count of successfully deleted records
    - Returns count of IDs that were not found
    - Non-existent IDs are silently ignored

    **Warning:** This is a permanent operation that cannot be reversed.
    Consider exporting important data before deletion.

    **Use Cases:**
    - Cleaning up test data during system maintenance
    - Removing invalid or corrupted test results
    - Data retention policy enforcement
    - Storage space management
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Extract required fields
        test_run_ids = delete_request.get("testRunIds")

        # Validate required fields
        if not test_run_ids or not isinstance(test_run_ids, list) or len(test_run_ids) == 0:
            raise HTTPException(
                status_code=400,
                detail="testRunIds array is required and must not be empty",
            )

        cursor = db.cursor()

        # Create placeholders for WHERE IN clause
        placeholders = ",".join(["?" for _ in test_run_ids])
        int_test_run_ids = [int(test_id) for test_id in test_run_ids]

        # Delete from test_runs_all
        cursor.execute(f"DELETE FROM test_runs_all WHERE id IN ({placeholders})", int_test_run_ids)
        deleted = cursor.rowcount
        not_found = len(test_run_ids) - deleted

        db.commit()

        log_info(
            "Bulk time-series test run delete completed",
            {
                "request_id": request_id,
                "user": user.username,
                "requested_count": len(test_run_ids),
                "deleted": deleted,
                "not_found": not_found,
            },
        )

        return {"deleted": deleted, "notFound": not_found}

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error during time-series delete", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to delete time-series test runs")


@router.get(
    "/history/cleanup-preview",
    summary="Preview Historical Data Cleanup",
    description="Preview how many records will be affected by a cleanup operation",
)
async def preview_history_cleanup(
    request: Request,
    cutoff_date: str = Query(..., description="Cutoff date in YYYY-MM-DD format"),
    mode: str = Query(..., description="Cleanup mode: 'delete-old' or 'compact'"),
    frequency: Optional[str] = Query(None, description="For compact mode: 'daily', 'weekly', or 'monthly'"),
    hostname: Optional[str] = Query(None, description="Optional hostname filter"),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Preview the number of records that will be affected by cleanup operation."""
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        if mode == "delete-old":
            # Simple deletion: count all records before cutoff date
            if hostname:
                cursor.execute(
                    "SELECT COUNT(*) FROM test_runs_all WHERE timestamp < ? AND hostname = ?",
                    [cutoff_date, hostname]
                )
            else:
                cursor.execute(
                    "SELECT COUNT(*) FROM test_runs_all WHERE timestamp < ?",
                    [cutoff_date]
                )
            affected_count = cursor.fetchone()[0]

        elif mode == "compact":
            # Compact mode: count records that will be deleted (not kept as daily/weekly/monthly)
            if frequency == "daily":
                date_format = "%Y-%m-%d"
            elif frequency == "weekly":
                date_format = "%Y-%W"  # Year-Week
            elif frequency == "monthly":
                date_format = "%Y-%m"
            else:
                raise HTTPException(status_code=400, detail="Invalid frequency")

            # Find records to delete (all except the most recent per period)
            if hostname:
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM test_runs_all
                    WHERE timestamp < ?
                    AND hostname = ?
                    AND id NOT IN (
                        SELECT MAX(id)
                        FROM test_runs_all
                        WHERE timestamp < ?
                        AND hostname = ?
                        GROUP BY strftime(?, timestamp), hostname, protocol, drive_model
                    )
                    """,
                    [cutoff_date, hostname, cutoff_date, hostname, date_format]
                )
            else:
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM test_runs_all
                    WHERE timestamp < ?
                    AND id NOT IN (
                        SELECT MAX(id)
                        FROM test_runs_all
                        WHERE timestamp < ?
                        GROUP BY strftime(?, timestamp), hostname, protocol, drive_model
                    )
                    """,
                    [cutoff_date, cutoff_date, date_format]
                )
            affected_count = cursor.fetchone()[0]

        else:
            raise HTTPException(status_code=400, detail="Invalid mode")

        log_info(
            "History cleanup preview completed",
            {
                "request_id": request_id,
                "mode": mode,
                "cutoff_date": cutoff_date,
                "frequency": frequency,
                "hostname": hostname,
                "affected_count": affected_count,
            },
        )

        return {"affected_count": affected_count}

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error previewing history cleanup", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to preview cleanup")


@router.post(
    "/history/cleanup",
    summary="Execute Historical Data Cleanup",
    description="Delete or compact old historical test data",
)
async def execute_history_cleanup(
    request: Request,
    cleanup_request: dict = Body(...),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """Execute cleanup operation on historical data."""
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cutoff_date = cleanup_request.get("cutoff_date")
        mode = cleanup_request.get("mode")
        frequency = cleanup_request.get("frequency")
        hostname = cleanup_request.get("hostname")

        if not cutoff_date or not mode:
            raise HTTPException(status_code=400, detail="Missing required parameters")

        cursor = db.cursor()

        if mode == "delete-old":
            # Simple deletion: remove all records before cutoff date
            if hostname:
                cursor.execute(
                    "DELETE FROM test_runs_all WHERE timestamp < ? AND hostname = ?",
                    [cutoff_date, hostname]
                )
            else:
                cursor.execute(
                    "DELETE FROM test_runs_all WHERE timestamp < ?",
                    [cutoff_date]
                )
            deleted_count = cursor.rowcount

        elif mode == "compact":
            # Compact mode: keep only daily/weekly/monthly samples before cutoff
            if frequency == "daily":
                date_format = "%Y-%m-%d"
            elif frequency == "weekly":
                date_format = "%Y-%W"
            elif frequency == "monthly":
                date_format = "%Y-%m"
            else:
                raise HTTPException(status_code=400, detail="Invalid frequency")

            # Delete all except the most recent per period
            if hostname:
                cursor.execute(
                    f"""
                    DELETE FROM test_runs_all
                    WHERE timestamp < ?
                    AND hostname = ?
                    AND id NOT IN (
                        SELECT MAX(id)
                        FROM test_runs_all
                        WHERE timestamp < ?
                        AND hostname = ?
                        GROUP BY strftime(?, timestamp), hostname, protocol, drive_model
                    )
                    """,
                    [cutoff_date, hostname, cutoff_date, hostname, date_format]
                )
            else:
                cursor.execute(
                    f"""
                    DELETE FROM test_runs_all
                    WHERE timestamp < ?
                    AND id NOT IN (
                        SELECT MAX(id)
                        FROM test_runs_all
                        WHERE timestamp < ?
                        GROUP BY strftime(?, timestamp), hostname, protocol, drive_model
                    )
                    """,
                    [cutoff_date, cutoff_date, date_format]
                )
            deleted_count = cursor.rowcount

        else:
            raise HTTPException(status_code=400, detail="Invalid mode")

        db.commit()

        log_info(
            "History cleanup executed successfully",
            {
                "request_id": request_id,
                "user": user.username,
                "mode": mode,
                "cutoff_date": cutoff_date,
                "frequency": frequency,
                "hostname": hostname,
                "deleted_count": deleted_count,
            },
        )

        return {"deleted_count": deleted_count, "mode": mode}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        log_error("Error executing history cleanup", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to execute cleanup")


def get_metric_unit(metric: str) -> str:
    """
    Get the appropriate unit string for a given performance metric.

    Maps metric type names to their standard measurement units
    for display and API response formatting.

    Args:
        metric: Metric type identifier (e.g., 'iops', 'avg_latency')

    Returns:
        Unit string for the metric, empty string if unknown
    """
    units = {
        "iops": "IOPS",
        "avg_latency": "ms",
        "p70_latency": "ms",
        "p90_latency": "ms",
        "p95_latency": "ms",
        "p99_latency": "ms",
        "bandwidth": "MB/s",
    }
    return units.get(metric, "")
