"""
Utils API router
"""

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request

# Removed FilterOptions import - using plain dictionary
from auth.middleware import User, require_admin
from config.settings import settings
from database.connection import get_db
from utils.logging import log_error, log_info

router = APIRouter()


@router.get(
    "/filters",
    summary="Get Filter Options",
    description="Retrieve all available filter values from the current test data",
    response_description="Complete filter options for UI dropdowns and validation",
    responses={
        200: {
            "description": "Filter options retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "drive_models": [
                            "Samsung SSD 980 PRO",
                            "WD Black SN850",
                            "Intel Optane P5800X",
                        ],
                        "host_disk_combinations": [
                            "server-01 - Local - Samsung SSD 980 PRO",
                            "server-02 - iSCSI - WD Black SN850",
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
                        "drive_types": ["NVMe", "SATA", "SAS"],
                    }
                }
            },
        },
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"},
    },
)
@router.get("/filters/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_filters(
    request: Request,
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db),
):
    """
    Retrieve all available filter values from the current test data.

    This endpoint scans the latest test runs and returns all unique values
    for each filterable field. Use this data to populate UI filter dropdowns
    and validate filter parameters in other API calls.

    **Authentication Required:** Admin access

    **Data Source:** Latest test runs (test_runs table)

    **Filter Categories:**
    - **drive_models**: All unique storage drive models
    - **host_disk_combinations**: Formatted hostname-protocol-drive combinations
    - **block_sizes**: All I/O block sizes found in test data
    - **patterns**: All I/O access patterns (randread, write, etc.)
    - **syncs**: Sync flag values (0=async, 1=sync)
    - **queue_depths**: All I/O queue depth values
    - **directs**: Direct I/O flag values (0=buffered, 1=direct)
    - **num_jobs**: All concurrent job count values
    - **test_sizes**: All test data size values
    - **durations**: All test duration values in seconds
    - **hostnames**: All server hostnames
    - **protocols**: All storage protocols
    - **drive_types**: All drive technology types

    **Use Cases:**
    - Populating filter dropdown menus
    - Validating filter parameters
    - Understanding available test configurations
    - Building dynamic query interfaces

    **Note:** Values are sorted alphabetically for consistent presentation.
    The host_disk_combinations field provides formatted strings for easy
    system identification in UIs.
    """
    request_id = getattr(request.state, "request_id", "unknown")

    try:
        cursor = db.cursor()
        filters = {}

        # Get distinct values for each filter (matching Node.js response order)
        filter_queries = [
            (
                "drive_models",
                "SELECT DISTINCT drive_model FROM test_runs WHERE drive_model IS NOT NULL ORDER BY drive_model",
            ),
            (
                "host_disk_combinations",
                "SELECT DISTINCT (hostname || ' - ' || protocol || ' - ' || drive_model) as host_disk_combo "
                "FROM test_runs WHERE hostname IS NOT NULL AND protocol IS NOT NULL AND drive_model IS NOT NULL "
                "ORDER BY host_disk_combo",
            ),
            (
                "block_sizes",
                "SELECT DISTINCT block_size FROM test_runs WHERE block_size IS NOT NULL ORDER BY block_size",
            ),
            (
                "patterns",
                "SELECT DISTINCT read_write_pattern FROM test_runs WHERE read_write_pattern IS NOT NULL ORDER BY read_write_pattern",
            ),
            (
                "syncs",
                "SELECT DISTINCT sync FROM test_runs WHERE sync IS NOT NULL ORDER BY sync",
            ),
            (
                "queue_depths",
                "SELECT DISTINCT queue_depth FROM test_runs WHERE queue_depth IS NOT NULL ORDER BY queue_depth",
            ),
            (
                "directs",
                "SELECT DISTINCT direct FROM test_runs WHERE direct IS NOT NULL ORDER BY direct",
            ),
            (
                "num_jobs",
                "SELECT DISTINCT num_jobs FROM test_runs WHERE num_jobs IS NOT NULL ORDER BY num_jobs",
            ),
            (
                "test_sizes",
                "SELECT DISTINCT test_size FROM test_runs WHERE test_size IS NOT NULL ORDER BY test_size",
            ),
            (
                "durations",
                "SELECT DISTINCT duration FROM test_runs WHERE duration IS NOT NULL ORDER BY duration",
            ),
            (
                "hostnames",
                "SELECT DISTINCT hostname FROM test_runs WHERE hostname IS NOT NULL ORDER BY hostname",
            ),
            (
                "protocols",
                "SELECT DISTINCT protocol FROM test_runs WHERE protocol IS NOT NULL ORDER BY protocol",
            ),
            (
                "drive_types",
                "SELECT DISTINCT drive_type FROM test_runs WHERE drive_type IS NOT NULL ORDER BY drive_type",
            ),
        ]

        for filter_name, query in filter_queries:
            cursor.execute(query)
            values = [row[0] for row in cursor.fetchall()]
            filters[filter_name] = values

        log_info(
            "Filter options retrieved successfully",
            {
                "request_id": request_id,
                "filter_counts": {k: len(v) for k, v in filters.items()},
                "total_filters": len(filters),
            },
        )

        return filters

    except Exception as e:
        log_error("Error retrieving filter options", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve filter options")


@router.get(
    "/info",
    summary="Get API Information",
    description="Retrieve basic information about the FIO Analyzer API",
    response_description="API metadata and version information",
    responses={
        200: {
            "description": "API information retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "name": "FIO Analyzer API",
                        "version": "1.0.0",
                        "description": "API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring",
                        "endpoints": 14,
                        "documentation": "/docs",
                    }
                }
            },
        }
    },
    tags=["API Info"],
)
@router.get("/info/", include_in_schema=False)  # Handle with trailing slash but hide from docs
async def get_api_info():
    """
    Retrieve basic information about the FIO Analyzer API.

    This endpoint provides metadata about the API including version,
    description, and links to documentation. Useful for API discovery
    and client application initialization.

    **No Authentication Required**

    **Returned Information:**
    - **name**: Human-readable API name
    - **version**: Current API version following semantic versioning
    - **description**: Brief description of API capabilities
    - **endpoints**: Count of available API endpoints
    - **documentation**: URL path to interactive API documentation

    **Use Cases:**
    - API health and version checking
    - Client application initialization
    - API discovery and capability detection
    - Documentation link resolution
    """
    return {
        "name": "FIO Analyzer API",
        "version": settings.version,
        "description": "API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring",
        "endpoints": 20,
        "documentation": "/docs",
        "redoc_documentation": "/redoc",
        "openapi_schema": "/openapi.json",
        "features": [
            "FIO benchmark data import",
            "Performance metrics analysis",
            "Historical time series data",
            "Trend analysis and statistics",
            "User management and authentication",
            "Bulk operations support",
        ],
        "supported_formats": ["JSON"],
        "authentication": "HTTP Basic Auth",
    }
