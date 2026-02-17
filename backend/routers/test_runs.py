"""
Test runs API router
"""

import sqlite3
from dataclasses import asdict
from typing import Optional

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Path,
    Query,
    Request,
)

from auth.middleware import User, require_admin
from database.connection import get_db
from database.models import BulkUpdateRequest
from utils.logging import log_error, log_info

router = APIRouter()


@router.get(
    "/",
    summary="Get Test Runs",
    description="Retrieve test runs with advanced filtering options for performance analysis",
    response_description="List of test runs matching the filter criteria",
    responses={
        200: {
            "description": "Successfully retrieved test runs",
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
                            "iops": 125000.5,
                            "avg_latency": 0.256,
                            "bandwidth": 488.28,
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
@router.get("", include_in_schema=False)  # Handle route without trailing slash but hide from docs
async def get_test_runs(
    request: Request,
    hostnames: Optional[str] = Query(
        None,
        description="Comma-separated list of hostnames to filter by (e.g., 'server-01,server-02')",
        example="server-01,server-02",
    ),
    drive_types: Optional[str] = Query(
        None,
        description="Comma-separated list of drive types to filter by (e.g., 'NVMe,SATA')",
        example="NVMe,SATA",
    ),
    drive_models: Optional[str] = Query(
        None,
        description="Comma-separated list of drive models to filter by",
        example="Samsung SSD 980 PRO,WD Black SN850",
    ),
    protocols: Optional[str] = Query(
        None,
        description="Comma-separated list of protocols to filter by (e.g., 'Local,iSCSI')",
        example="Local,iSCSI",
    ),
    patterns: Optional[str] = Query(
        None,
        description="Comma-separated list of I/O patterns to filter by (e.g., 'randread,randwrite')",
        example="randread,randwrite,read",
    ),
    block_sizes: Optional[str] = Query(
        None,
        description="Comma-separated list of block sizes to filter by (e.g., '4K,64K')",
        example="4K,8K,64K",
    ),
    syncs: Optional[str] = Query(
        None,
        description="Comma-separated list of sync flag values to filter by (0=async, 1=sync)",
        example="0,1",
    ),
    queue_depths: Optional[str] = Query(
        None,
        description="Comma-separated list of queue depths to filter by",
        example="1,8,32,64",
    ),
    directs: Optional[str] = Query(
        None,
        description="Comma-separated list of direct I/O flag values (0=buffered, 1=direct)",
        example="0,1",
    ),
    num_jobs: Optional[str] = Query(
        None,
        description="Comma-separated list of number of jobs to filter by",
        example="1,4,8",
    ),
    test_sizes: Optional[str] = Query(
        None,
        description="Comma-separated list of test sizes to filter by",
        example="1G,10G,100G",
    ),
    durations: Optional[str] = Query(
        None,
        description="Comma-separated list of test durations in seconds to filter by",
        example="30,60,300",
    ),
    limit: int = Query(
        1000,
        ge=1,
        le=10000,
        description="Maximum number of test runs to return",
        example=100,
    ),
    offset: int = Query(0, ge=0, description="Number of test runs to skip for pagination", example=0),
    include_metadata: bool = Query(
        False,
        description="Include total count and pagination metadata in response",
        example=False,
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve test runs with comprehensive filtering capabilities.

    This endpoint provides access to the latest test run data with extensive
    filtering options for performance analysis and monitoring. All filters support
    multiple values using comma-separated lists.

    **Authentication Required:** Admin access

    **Filter Examples:**
    - Get all NVMe drives: `?drive_types=NVMe`
    - Get specific hosts: `?hostnames=server-01,server-02`
    - Get 4K random reads: `?block_sizes=4K&patterns=randread`
    - Get high queue depth tests: `?queue_depths=32,64`

    **Performance Metrics Included:**
    - IOPS (Input/Output Operations Per Second)
    - Average latency in milliseconds
    - Bandwidth in MB/s
    - 95th and 99th percentile latency
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Build WHERE clause
        where_conditions = []
        params = []

        if hostnames:
            hostname_list = [h.strip() for h in hostnames.split(",")]
            placeholders = ",".join(["?" for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)

        if drive_types:
            drive_type_list = [d.strip() for d in drive_types.split(",")]
            placeholders = ",".join(["?" for _ in drive_type_list])
            where_conditions.append(f"drive_type IN ({placeholders})")
            params.extend(drive_type_list)

        # ADDED: drive_models filter
        if drive_models:
            drive_model_list = [d.strip() for d in drive_models.split(",")]
            placeholders = ",".join(["?" for _ in drive_model_list])
            where_conditions.append(f"drive_model IN ({placeholders})")
            params.extend(drive_model_list)

        if protocols:
            protocol_list = [p.strip() for p in protocols.split(",")]
            placeholders = ",".join(["?" for _ in protocol_list])
            where_conditions.append(f"protocol IN ({placeholders})")
            params.extend(protocol_list)

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

        # ADDED: syncs filter (integer conversion)
        if syncs:
            sync_list = [int(s.strip()) for s in syncs.split(",")]
            placeholders = ",".join(["?" for _ in sync_list])
            where_conditions.append(f"sync IN ({placeholders})")
            params.extend(sync_list)

        # ADDED: queue_depths filter (integer conversion)
        if queue_depths:
            queue_depth_list = [int(q.strip()) for q in queue_depths.split(",")]
            placeholders = ",".join(["?" for _ in queue_depth_list])
            where_conditions.append(f"queue_depth IN ({placeholders})")
            params.extend(queue_depth_list)

        # ADDED: directs filter (integer conversion)
        if directs:
            direct_list = [int(d.strip()) for d in directs.split(",")]
            placeholders = ",".join(["?" for _ in direct_list])
            where_conditions.append(f"direct IN ({placeholders})")
            params.extend(direct_list)

        # ADDED: num_jobs filter (integer conversion)
        if num_jobs:
            num_jobs_list = [int(n.strip()) for n in num_jobs.split(",")]
            placeholders = ",".join(["?" for _ in num_jobs_list])
            where_conditions.append(f"num_jobs IN ({placeholders})")
            params.extend(num_jobs_list)

        # ADDED: test_sizes filter
        if test_sizes:
            test_size_list = [s.strip() for s in test_sizes.split(",")]
            placeholders = ",".join(["?" for _ in test_size_list])
            where_conditions.append(f"test_size IN ({placeholders})")
            params.extend(test_size_list)

        # ADDED: durations filter (integer conversion)
        if durations:
            duration_list = [int(d.strip()) for d in durations.split(",")]
            placeholders = ",".join(["?" for _ in duration_list])
            where_conditions.append(f"duration IN ({placeholders})")
            params.extend(duration_list)

        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"

        # Get total count
        cursor = db.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM test_runs WHERE {where_clause}", params)
        total = cursor.fetchone()[0]

        # Get test runs (exclude test_date to match Node.js response format)
        query = f"""
            SELECT id, timestamp, drive_model, drive_type, test_name, description,
                   block_size, read_write_pattern, queue_depth, duration,
                   fio_version, job_runtime, rwmixread, total_ios_read,
                   total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                   output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                   avg_latency, bandwidth, iops, p70_latency, p90_latency, p95_latency, p99_latency,
                   config_uuid, run_uuid
            FROM test_runs
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])
        rows = cursor.fetchall()

        # Convert to dictionaries
        test_runs = []
        for row in rows:
            test_run_data = dict(row)
            test_run_data["block_size"] = str(test_run_data["block_size"])  # Ensure string
            test_runs.append(test_run_data)

        log_info(
            "Test runs retrieved successfully",
            {
                "request_id": request_id,
                "total": total,
                "returned": len(test_runs),
                "filters": {
                    "hostnames": hostnames,
                    "drive_types": drive_types,
                    "protocols": protocols,
                    "patterns": patterns,
                    "block_sizes": block_sizes,
                },
            },
        )

        # Return metadata if requested, otherwise return direct array for backward compatibility
        if include_metadata:
            return {
                "data": test_runs,
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + len(test_runs)) < total,
            }
        
        # Frontend expects direct array of test runs, not wrapped object
        return test_runs

    except Exception as e:
        log_error("Error retrieving test runs", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve test runs")


@router.put(
    "/bulk",
    summary="Bulk Update Test Runs",
    description="Update multiple test runs with new metadata in a single operation",
    response_description="Bulk update operation results",
    responses={
        200: {
            "description": "Bulk update completed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Successfully updated 5 test runs",
                        "updated": 5,
                        "failed": 0,
                    }
                }
            },
        },
        400: {"description": "Invalid request data or no updates provided"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
@router.put("/bulk/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def bulk_update_test_runs(
    request: Request,
    bulk_request: BulkUpdateRequest,
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Perform bulk updates on multiple test runs simultaneously.

    This endpoint allows you to update metadata fields for multiple test runs
    in a single atomic operation. Only the specified fields will be updated,
    leaving other fields unchanged.

    **Authentication Required:** Admin access

    **Updatable Fields:**
    - description: Test description or notes
    - test_name: Human-readable test name
    - hostname: Server hostname
    - protocol: Storage protocol (Local, iSCSI, etc.)
    - drive_type: Drive technology type
    - drive_model: Specific drive model

    **Request Body Example:**
    ```json
    {
        "test_run_ids": [1, 2, 3],
        "updates": {
            "description": "Updated description",
            "hostname": "new-server-name"
        }
    }
    ```
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Validate that we have updates to apply

        updates = {k: v for k, v in asdict(bulk_request.updates).items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        # Build update query
        set_clauses = []
        params = []

        for field, value in updates.items():
            set_clauses.append(f"{field} = ?")
            params.append(value)

        set_clause = ", ".join(set_clauses)
        placeholders = ",".join(["?" for _ in bulk_request.test_run_ids])
        params.extend(bulk_request.test_run_ids)

        # Execute update
        cursor = db.cursor()
        update_query = f"""
            UPDATE test_runs
            SET {set_clause}
            WHERE id IN ({placeholders})
        """
        cursor.execute(update_query, params)
        updated = cursor.rowcount

        # Also update test_runs_all
        cursor.execute(
            f"""
            UPDATE test_runs_all
            SET {set_clause}
            WHERE id IN ({placeholders})
        """,
            params,
        )

        db.commit()

        log_info(
            "Bulk update completed successfully",
            {
                "request_id": request_id,
                "user": user.username,
                "updated": updated,
                "test_run_ids": bulk_request.test_run_ids,
                "updates": updates,
            },
        )

        return {
            "message": f"Successfully updated {updated} test runs",
            "updated": updated,
            "failed": len(bulk_request.test_run_ids) - updated,
        }

    except Exception as e:
        log_error("Error during bulk update", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update test runs")


@router.put(
    "/bulk-by-uuid",
    summary="Bulk Update Test Runs by UUID",
    description="Update all test runs with a specific config_uuid or run_uuid",
    response_description="Bulk update operation results",
    responses={
        200: {
            "description": "Bulk update by UUID completed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Successfully updated 15 test runs",
                        "updated": 15,
                        "uuid": "550e8400-e29b-41d4-a716-446655440000",
                    }
                }
            },
        },
        400: {"description": "Invalid request data or missing UUID filter"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
async def bulk_update_test_runs_by_uuid(
    request: Request,
    config_uuid: Optional[str] = Query(None, description="Update all runs with this config_uuid"),
    run_uuid: Optional[str] = Query(None, description="Update all runs with this run_uuid"),
    updates: dict = Body(..., description="Fields to update (description, test_name, hostname, protocol, drive_type, drive_model)"),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Perform bulk updates on all test runs matching a UUID filter.

    Updates all test runs that match either a config_uuid or run_uuid.
    This is useful for renaming all tests from a specific host configuration
    or all tests from a single script execution.

    **Authentication Required:** Admin access

    **UUID Filters** (specify exactly one):
    - config_uuid: Update all runs from this host configuration
    - run_uuid: Update all runs from this script execution

    **Updatable Fields:**
    - description, test_name, hostname, protocol, drive_type, drive_model

    **Example Request:**
    ```
    PUT /api/test-runs/bulk-by-uuid?config_uuid=550e8400-e29b-41d4-a716-446655440000
    Body: {"hostname": "new-server-name", "description": "Updated description"}
    ```
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Validate UUID filter
        if not config_uuid and not run_uuid:
            raise HTTPException(
                status_code=400,
                detail="Must specify either config_uuid or run_uuid parameter"
            )

        if config_uuid and run_uuid:
            raise HTTPException(
                status_code=400,
                detail="Cannot specify both config_uuid and run_uuid. Choose one."
            )

        # Validate updates
        allowed_fields = {"description", "test_name", "hostname", "protocol", "drive_type", "drive_model"}
        invalid_fields = set(updates.keys()) - allowed_fields
        if invalid_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid fields: {', '.join(invalid_fields)}. Allowed: {', '.join(allowed_fields)}"
            )

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        # Build update query
        set_clauses = []
        params = []

        for field, value in updates.items():
            set_clauses.append(f"{field} = ?")
            params.append(value)

        set_clause = ", ".join(set_clauses)

        # Determine which UUID to filter by
        uuid_field = "config_uuid" if config_uuid else "run_uuid"
        uuid_value = config_uuid if config_uuid else run_uuid
        params.append(uuid_value)

        # Execute update on test_runs
        cursor = db.cursor()
        update_query = f"""
            UPDATE test_runs
            SET {set_clause}
            WHERE {uuid_field} = ?
        """
        cursor.execute(update_query, params)
        updated = cursor.rowcount

        # Also update test_runs_all
        cursor.execute(
            f"""
            UPDATE test_runs_all
            SET {set_clause}
            WHERE {uuid_field} = ?
        """,
            params,
        )

        db.commit()

        log_info(
            "Bulk update by UUID completed successfully",
            {
                "request_id": request_id,
                "user": user.username,
                "updated": updated,
                "uuid_field": uuid_field,
                "uuid_value": uuid_value,
                "updates": updates,
            },
        )

        return {
            "message": f"Successfully updated {updated} test runs",
            "updated": updated,
            "uuid": uuid_value,
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error during bulk update by UUID", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update test runs by UUID")


@router.get(
    "/performance-data",
    summary="Get Performance Data",
    description="Retrieve detailed performance metrics for specific test runs",
    response_description="Performance data with metrics for each test run",
    responses={
        200: {
            "description": "Performance data retrieved successfully",
            "content": {
                "application/json": {
                    "example": [
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
                                "p70_latency": {"value": 0.384, "unit": "ms"},
                                "p90_latency": {"value": 0.448, "unit": "ms"},
                                "p95_latency": {"value": 0.512, "unit": "ms"},
                                "p99_latency": {"value": 1.024, "unit": "ms"},
                            },
                        }
                    ]
                }
            },
        },
        400: {"description": "Invalid test run IDs format"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "One or more test runs not found"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/performance-data/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_performance_data(
    request: Request,
    test_run_ids: str = Query(
        ...,
        description="Comma-separated list of test run IDs to retrieve performance data for",
        example="1,2,3,15,42",
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve detailed performance metrics for specific test runs.

    This endpoint returns comprehensive performance data including all measured
    metrics (IOPS, latency, bandwidth) with proper units for each specified test run.

    **Authentication Required:** Admin access

    **Performance Metrics:**
    - **IOPS**: Input/Output Operations Per Second
    - **Average Latency**: Mean response time in milliseconds
    - **Bandwidth**: Data transfer rate in MB/s
    - **P95 Latency**: 95th percentile latency in milliseconds
    - **P99 Latency**: 99th percentile latency in milliseconds

    **Use Cases:**
    - Performance comparison between test runs
    - Detailed analysis of specific workloads
    - Generating performance reports
    - Data visualization and charting
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Parse parameters
        test_run_id_list = [int(id.strip()) for id in test_run_ids.split(",")]

        # Build query
        cursor = db.cursor()

        results = []
        for test_run_id in test_run_id_list:
            cursor.execute(
                """
                SELECT id, timestamp, drive_model, drive_type, test_name, description,
                       block_size, read_write_pattern, queue_depth, duration,
                       fio_version, job_runtime, rwmixread, total_ios_read,
                       total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                       uploaded_file_path, output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                       avg_latency, bandwidth, iops, p95_latency, p99_latency,
                       config_uuid, run_uuid
                FROM test_runs WHERE id = ?
            """,
                (test_run_id,),
            )
            row = cursor.fetchone()

            if row:
                test_run_data = dict(row)

                # Create response matching Node.js format
                result = {
                    "id": test_run_data["id"],
                    "drive_model": test_run_data["drive_model"],
                    "drive_type": test_run_data["drive_type"],
                    "test_name": test_run_data["test_name"],
                    "description": test_run_data["description"],
                    "block_size": str(test_run_data["block_size"]),
                    "read_write_pattern": test_run_data["read_write_pattern"],
                    "timestamp": test_run_data["timestamp"],
                    "queue_depth": test_run_data["queue_depth"],
                    "hostname": test_run_data["hostname"],
                    "protocol": test_run_data["protocol"],
                    "output_file": test_run_data["output_file"],
                    "num_jobs": test_run_data["num_jobs"],
                    "direct": test_run_data["direct"],
                    "test_size": test_run_data["test_size"],
                    "sync": test_run_data["sync"],
                    "iodepth": test_run_data["iodepth"],
                    "duration": test_run_data["duration"],
                    "config_uuid": test_run_data["config_uuid"],
                    "run_uuid": test_run_data["run_uuid"],
                    "metrics": {
                        "avg_latency": ({"value": test_run_data["avg_latency"], "unit": "ms"} if test_run_data["avg_latency"] is not None else None),
                        "bandwidth": ({"value": test_run_data["bandwidth"], "unit": "MB/s"} if test_run_data["bandwidth"] is not None else None),
                        "iops": ({"value": test_run_data["iops"], "unit": "IOPS"} if test_run_data["iops"] is not None else None),
                        "p70_latency": ({"value": test_run_data["p70_latency"], "unit": "ms"} if test_run_data["p70_latency"] is not None else None),
                        "p90_latency": ({"value": test_run_data["p90_latency"], "unit": "ms"} if test_run_data["p90_latency"] is not None else None),
                        "p95_latency": ({"value": test_run_data["p95_latency"], "unit": "ms"} if test_run_data["p95_latency"] is not None else None),
                        "p99_latency": ({"value": test_run_data["p99_latency"], "unit": "ms"} if test_run_data["p99_latency"] is not None else None),
                    },
                }

                results.append(result)

        log_info(
            "Performance data retrieved successfully",
            {
                "request_id": request_id,
                "test_run_ids": test_run_id_list,
                "results_count": len(results),
            },
        )

        return results

    except Exception as e:
        log_error("Error retrieving performance data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve performance data")


@router.get(
    "/saturation-runs",
    summary="List Saturation Test Runs",
    description="List all saturation test runs with summary information",
    response_description="List of saturation runs grouped by run_uuid",
    responses={
        200: {
            "description": "Saturation runs retrieved successfully",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "run_uuid": "550e8400-e29b-41d4-a716-446655440000",
                            "hostname": "server-01",
                            "protocol": "Local",
                            "drive_type": "NVMe",
                            "drive_model": "Samsung 980 PRO",
                            "started": "2025-06-31T20:00:00",
                            "step_count": 8,
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
async def get_saturation_runs(
    request: Request,
    hostname: Optional[str] = Query(
        None,
        description="Filter by hostname",
        example="server-01",
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="Maximum number of runs to return",
    ),
    offset: int = Query(
        0,
        ge=0,
        description="Number of runs to skip",
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    List all saturation test runs.

    Identifies saturation tests by the 'saturation-test' prefix in the description field.
    Returns summary information for each run grouped by run_uuid.

    **Authentication Required:** Admin access
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        where_clause = "description LIKE 'saturation-test%'"
        params = []

        if hostname:
            where_clause += " AND hostname = ?"
            params.append(hostname)

        query = f"""
            SELECT run_uuid, hostname, protocol, drive_type, drive_model,
                   MIN(timestamp) as started, COUNT(*) as step_count
            FROM test_runs_all
            WHERE {where_clause} AND run_uuid IS NOT NULL
            GROUP BY run_uuid
            ORDER BY MIN(timestamp) DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for row in rows:
            row_dict = dict(row)
            results.append({
                "run_uuid": row_dict["run_uuid"],
                "hostname": row_dict["hostname"],
                "protocol": row_dict["protocol"],
                "drive_type": row_dict["drive_type"],
                "drive_model": row_dict["drive_model"],
                "started": row_dict["started"],
                "step_count": row_dict["step_count"],
            })

        log_info(
            "Saturation runs retrieved",
            {"request_id": request_id, "count": len(results)},
        )

        return results

    except Exception as e:
        log_error("Error retrieving saturation runs", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve saturation runs")


@router.get(
    "/saturation-data",
    summary="Get Saturation Test Data",
    description="Get detailed step-by-step data for a specific saturation test run",
    response_description="Saturation test data with steps grouped by pattern",
    responses={
        200: {
            "description": "Saturation data retrieved successfully",
        },
        400: {"description": "Missing run_uuid parameter"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "No saturation data found for this run_uuid"},
        500: {"description": "Internal server error"},
    },
)
async def get_saturation_data(
    request: Request,
    run_uuid: str = Query(
        ...,
        description="The run_uuid of the saturation test run",
        example="550e8400-e29b-41d4-a716-446655440000",
    ),
    threshold_ms: float = Query(
        100.0,
        ge=0.01,
        le=100000.0,
        description="P95 latency threshold in milliseconds for sweet spot calculation",
        example=100.0,
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Get detailed saturation test data for a specific run.

    Returns all steps sorted by total outstanding I/O (iodepth * num_jobs),
    grouped by read/write pattern. Calculates sweet spot and saturation point
    for each pattern based on the P95 latency threshold.

    **Authentication Required:** Admin access
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        query = """
            SELECT id, timestamp, hostname, protocol, drive_type, drive_model,
                   block_size, read_write_pattern, iodepth, num_jobs,
                   iops, avg_latency, bandwidth, p95_latency, p99_latency,
                   config_uuid, run_uuid, description
            FROM test_runs_all
            WHERE run_uuid = ? AND description LIKE 'saturation-test%'
            ORDER BY (iodepth * num_jobs) ASC
        """
        cursor.execute(query, (run_uuid,))
        rows = cursor.fetchall()

        if not rows:
            raise HTTPException(
                status_code=404,
                detail=f"No saturation data found for run_uuid: {run_uuid}"
            )

        # Group by pattern
        patterns: dict = {}
        hostname = None
        protocol = None
        drive_type = None
        drive_model = None

        for row in rows:
            row_dict = dict(row)
            if hostname is None:
                hostname = row_dict["hostname"]
                protocol = row_dict["protocol"]
                drive_type = row_dict["drive_type"]
                drive_model = row_dict["drive_model"]

            pattern = row_dict["read_write_pattern"]
            if pattern not in patterns:
                patterns[pattern] = {"steps": []}

            iodepth = row_dict["iodepth"] if row_dict["iodepth"] is not None else 1
            num_jobs_val = row_dict["num_jobs"] if row_dict["num_jobs"] is not None else 1
            total_qd = iodepth * num_jobs_val

            step = {
                "id": row_dict["id"],
                "iodepth": iodepth,
                "num_jobs": num_jobs_val,
                "total_qd": total_qd,
                "iops": row_dict["iops"],
                "avg_latency_ms": row_dict["avg_latency"],
                "p95_latency_ms": row_dict["p95_latency"],
                "p99_latency_ms": row_dict["p99_latency"],
                "bandwidth_mbs": row_dict["bandwidth"],
                "timestamp": row_dict["timestamp"],
            }
            patterns[pattern]["steps"].append(step)

        # Calculate sweet spot and saturation point per pattern
        for pattern_name, pattern_data in patterns.items():
            steps = pattern_data["steps"]
            sweet_spot = None
            saturation_point = None

            for step in steps:
                p95 = step.get("p95_latency_ms")

                # Skip steps with missing/invalid p95 data
                if p95 is None or not isinstance(p95, (int, float)) or p95 < 0:
                    continue

                if p95 > threshold_ms:
                    saturation_point = step
                    # Sweet spot is the last step BEFORE saturation
                    # (already set by the loop below)
                    break

                # Keep updating sweet_spot to the last step within SLA
                sweet_spot = step

            # If no saturation found and we had valid steps, sweet_spot
            # is already set to the last valid step by the loop above.

            pattern_data["sweet_spot"] = sweet_spot
            pattern_data["saturation_point"] = saturation_point

        result = {
            "run_uuid": run_uuid,
            "hostname": hostname,
            "protocol": protocol,
            "drive_type": drive_type,
            "drive_model": drive_model,
            "threshold_ms": threshold_ms,
            "patterns": patterns,
        }

        log_info(
            "Saturation data retrieved",
            {
                "request_id": request_id,
                "run_uuid": run_uuid,
                "patterns": list(patterns.keys()),
                "total_steps": sum(len(p["steps"]) for p in patterns.values()),
            },
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error retrieving saturation data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve saturation data")


@router.get(
    "/grouped-by-uuid",
    summary="Get Test Runs Grouped by UUID",
    description="Retrieve test runs grouped by config_uuid or run_uuid with statistics",
    response_description="UUID groups with statistics and test run information",
    responses={
        200: {
            "description": "Successfully retrieved UUID-grouped data",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "uuid": "550e8400-e29b-41d4-a716-446655440000",
                            "count": 15,
                            "avg_iops": 125000.5,
                            "first_test": "2025-01-15T10:00:00",
                            "last_test": "2025-06-31T20:00:00",
                            "sample_metadata": {
                                "hostname": "server-01",
                                "protocol": "Local",
                                "drive_model": "Samsung SSD 980 PRO",
                                "drive_type": "NVMe"
                            },
                            "test_run_ids": [1, 2, 3, 15, 42]
                        }
                    ]
                }
            }
        },
        400: {"description": "Invalid group_by parameter"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
async def get_test_runs_grouped_by_uuid(
    request: Request,
    group_by: str = Query(
        ...,
        description="Field to group by (config_uuid or run_uuid)",
        example="config_uuid",
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve test runs grouped by UUID with statistics.

    Groups all test runs by either config_uuid (host configuration) or
    run_uuid (script execution), and provides aggregate statistics for each group.

    **Authentication Required:** Admin access

    **Group By Options:**
    - `config_uuid`: Group by host configuration (all tests from same hostname)
    - `run_uuid`: Group by script execution (all tests from single script run)

    **Statistics Provided:**
    - Total count of tests in group
    - Average IOPS across all tests
    - Date range (first and last test timestamps)
    - Sample metadata from the group
    - List of all test run IDs in the group
    """
    request_id = getattr(request.state, "request_id", "unknown")

    # Validate group_by parameter
    if group_by not in ["config_uuid", "run_uuid"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid group_by parameter. Must be 'config_uuid' or 'run_uuid'"
        )

    try:
        cursor = db.cursor()

        # Simplified query without window functions for better compatibility
        query = f"""
            SELECT
                {group_by} as uuid,
                COUNT(*) as count,
                AVG(iops) as avg_iops,
                MIN(timestamp) as first_test,
                MAX(timestamp) as last_test,
                GROUP_CONCAT(id) as test_run_ids
            FROM test_runs
            WHERE {group_by} IS NOT NULL
            GROUP BY {group_by}
            ORDER BY MAX(timestamp) DESC
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        # For each group, get sample metadata from the first (earliest) record
        results = []
        for row in rows:
            row_dict = dict(row)
            uuid_value = row_dict["uuid"]

            # Get sample metadata (from first record in this UUID group)
            cursor.execute(
                f"""
                SELECT hostname, protocol, drive_model, drive_type
                FROM test_runs
                WHERE {group_by} = ?
                ORDER BY timestamp
                LIMIT 1
                """,
                (uuid_value,)
            )
            metadata_row = cursor.fetchone()

            if metadata_row:
                metadata_dict = dict(metadata_row)
            else:
                metadata_dict = {
                    "hostname": None,
                    "protocol": None,
                    "drive_model": None,
                    "drive_type": None
                }

            test_run_ids_str = row_dict["test_run_ids"]
            test_run_ids = [int(id_str) for id_str in test_run_ids_str.split(",")] if test_run_ids_str else []

            result = {
                "uuid": uuid_value,
                "count": row_dict["count"],
                "avg_iops": round(row_dict["avg_iops"], 2) if row_dict["avg_iops"] else None,
                "first_test": row_dict["first_test"],
                "last_test": row_dict["last_test"],
                "sample_metadata": {
                    "hostname": metadata_dict["hostname"],
                    "protocol": metadata_dict["protocol"],
                    "drive_model": metadata_dict["drive_model"],
                    "drive_type": metadata_dict["drive_type"]
                },
                "test_run_ids": test_run_ids
            }
            results.append(result)

        log_info(
            "UUID-grouped test runs retrieved successfully",
            {
                "request_id": request_id,
                "group_by": group_by,
                "groups_count": len(results),
            },
        )

        return results

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error retrieving UUID-grouped test runs", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve UUID-grouped test runs")


@router.get(
    "/{test_run_id}",
    summary="Get Single Test Run",
    description="Retrieve detailed information for a specific test run by ID",
    response_description="Complete test run data including all metrics and metadata",
    responses={
        200: {
            "description": "Test run retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "timestamp": "2025-06-31T20:00:00",
                        "hostname": "server-01",
                        "drive_model": "Samsung SSD 980 PRO",
                        "drive_type": "NVMe",
                        "test_name": "random_read_4k",
                        "description": "4K random read performance test",
                        "block_size": "4K",
                        "read_write_pattern": "randread",
                        "queue_depth": 32,
                        "duration": 300,
                        "protocol": "Local",
                        "iops": 125000.5,
                        "avg_latency": 0.256,
                        "bandwidth": 488.28,
                        "p70_latency": 0.384,
                        "p90_latency": 0.448,
                        "p95_latency": 0.512,
                        "p99_latency": 1.024,
                    }
                }
            },
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "Test run not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_test_run(
    request: Request,
    test_run_id: int = Path(
        ...,
        description="Unique identifier of the test run to retrieve",
        example=1,
        gt=0,
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve complete information for a single test run.

    This endpoint returns all available data for a specific test run,
    including configuration parameters, performance metrics, and metadata.

    **Authentication Required:** Admin access

    **Returned Data:**
    - Test configuration (block size, pattern, queue depth, etc.)
    - Performance metrics (IOPS, latency, bandwidth)
    - System information (hostname, drive details, protocol)
    - Test metadata (description, timestamps, FIO version)
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()
        cursor.execute(
            """
            SELECT id, timestamp, drive_model, drive_type, test_name, description,
                   block_size, read_write_pattern, queue_depth, duration,
                   fio_version, job_runtime, rwmixread, total_ios_read,
                   total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                   output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                   avg_latency, bandwidth, iops, p70_latency, p90_latency, p95_latency, p99_latency,
                   config_uuid, run_uuid
            FROM test_runs WHERE id = ?
        """,
            (test_run_id,),
        )

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Test run not found")

        test_run_data = dict(row)
        test_run_data["block_size"] = str(test_run_data["block_size"])  # Ensure string

        log_info(
            "Test run retrieved successfully",
            {"request_id": request_id, "test_run_id": test_run_id},
        )

        return test_run_data

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error retrieving test run", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve test run")


@router.put(
    "/{test_run_id}",
    summary="Update Test Run",
    description="Update metadata fields for a specific test run",
    response_description="Update operation confirmation",
    responses={
        200: {
            "description": "Test run updated successfully",
            "content": {"application/json": {"example": {"message": "Test run updated successfully"}}},
        },
        400: {"description": "Invalid field names or values provided"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "Test run not found"},
        500: {"description": "Internal server error"},
    },
)
async def update_test_run(
    request: Request,
    test_run_id: int = Path(..., description="Unique identifier of the test run to update", example=1, gt=0),
    update_data: dict = Body(
        ...,
        description="Fields to update with their new values",
        example={
            "description": "Updated test description",
            "hostname": "new-server-name",
            "test_name": "Updated test name",
        },
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Update metadata fields for a specific test run.

    This endpoint allows updating editable metadata fields while preserving
    the original performance data and test configuration.

    **Authentication Required:** Admin access

    **Updatable Fields:**
    - description: Test description or notes
    - test_name: Human-readable test name
    - hostname: Server hostname
    - protocol: Storage protocol
    - drive_type: Drive technology type
    - drive_model: Specific drive model

    **Note:** Performance metrics and test configuration parameters
    (block size, queue depth, etc.) cannot be modified.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        # Define allowed fields for validation
        allowed_fields = [
            "description",
            "test_name",
            "hostname",
            "protocol",
            "drive_type",
            "drive_model",
        ]
        submitted_fields = list(update_data.keys())

        # Check for invalid fields
        invalid_fields = [field for field in submitted_fields if field not in allowed_fields]
        if invalid_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid fields: {', '.join(invalid_fields)}. Allowed fields: {', '.join(allowed_fields)}",
            )

        # Simple validation
        validation = {
            "hostname": {"maxLength": 255},
            "protocol": {"maxLength": 100},
            "description": {"maxLength": 1000},
            "test_name": {"maxLength": 500},
            "drive_type": {"maxLength": 100},
            "drive_model": {"maxLength": 255},
        }

        for field, value in update_data.items():
            if value and field in validation and len(str(value)) > validation[field]["maxLength"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Field '{field}' exceeds maximum length of {validation[field]['maxLength']} characters",
                )

        # Build update query
        cursor = db.cursor()

        # Update test_runs table
        cursor.execute(
            """
            UPDATE test_runs
            SET description = COALESCE(?, description),
                test_name = COALESCE(?, test_name),
                hostname = COALESCE(?, hostname),
                protocol = COALESCE(?, protocol),
                drive_type = COALESCE(?, drive_type),
                drive_model = COALESCE(?, drive_model)
            WHERE id = ?
        """,
            [
                update_data.get("description"),
                update_data.get("test_name"),
                update_data.get("hostname"),
                update_data.get("protocol"),
                update_data.get("drive_type"),
                update_data.get("drive_model"),
                test_run_id,
            ],
        )

        latest_updated = cursor.rowcount

        # Also update test_runs_all table
        cursor.execute(
            """
            UPDATE test_runs_all
            SET description = COALESCE(?, description),
                test_name = COALESCE(?, test_name),
                hostname = COALESCE(?, hostname),
                protocol = COALESCE(?, protocol),
                drive_type = COALESCE(?, drive_type),
                drive_model = COALESCE(?, drive_model)
            WHERE id = ?
        """,
            [
                update_data.get("description"),
                update_data.get("test_name"),
                update_data.get("hostname"),
                update_data.get("protocol"),
                update_data.get("drive_type"),
                update_data.get("drive_model"),
                test_run_id,
            ],
        )

        db.commit()

        if latest_updated == 0:
            raise HTTPException(status_code=404, detail="Test run not found")

        log_info(
            "Test run updated successfully",
            {
                "request_id": request_id,
                "user": user.username,
                "test_run_id": test_run_id,
                "updated_fields": submitted_fields,
                "changes": update_data,
            },
        )

        return {"message": "Test run updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating test run", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update test run")


@router.delete(
    "/{test_run_id}",
    summary="Delete Test Run",
    description="Permanently delete a test run and all associated data",
    response_description="Deletion confirmation",
    responses={
        200: {
            "description": "Test run deleted successfully",
            "content": {"application/json": {"example": {"message": "Test run deleted successfully"}}},
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        404: {"description": "Test run not found"},
        500: {"description": "Internal server error"},
    },
)
async def delete_test_run(
    request: Request,
    test_run_id: int = Path(..., description="Unique identifier of the test run to delete", example=1, gt=0),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Permanently delete a test run and all associated data.

    This operation removes the test run from both the latest test runs table
    and the historical data table. This action cannot be undone.

    **Authentication Required:** Admin access

    **Warning:** This is a permanent operation that cannot be reversed.
    Consider exporting important data before deletion.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()

        # Delete from both tables
        cursor.execute("DELETE FROM test_runs WHERE id = ?", (test_run_id,))
        latest_deleted = cursor.rowcount

        cursor.execute("DELETE FROM test_runs_all WHERE id = ?", (test_run_id,))
        all_deleted = cursor.rowcount

        db.commit()

        if latest_deleted == 0 and all_deleted == 0:
            raise HTTPException(status_code=404, detail="Test run not found")

        log_info(
            "Test run deleted successfully",
            {
                "request_id": request_id,
                "user": user.username,
                "test_run_id": test_run_id,
                "latest_deleted": latest_deleted,
                "all_deleted": all_deleted,
            },
        )

        return {"message": "Test run deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error deleting test run", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to delete test run")


def get_metric_unit(metric_type: str) -> str:
    """Get unit for metric type"""
    units = {
        "iops": "IOPS",
        "avg_latency": "ms",
        "p70_latency": "ms",
        "p90_latency": "ms",
        "p95_latency": "ms",
        "p99_latency": "ms",
        "bandwidth": "MB/s",
    }
    return units.get(metric_type, "")
