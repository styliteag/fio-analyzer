"""
Utils API router
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
import sqlite3

from database.connection import get_db
# Removed FilterOptions import - using plain dictionary
from auth.middleware import require_auth, User
from utils.logging import log_info, log_error


router = APIRouter()


@router.get("/filters")
@router.get("/filters/")  # Handle with trailing slash
async def get_filters(
    request: Request,
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get available filter options"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        filters = {}
        
        # Get distinct values for each filter
        filter_queries = [
            ("drive_models", "SELECT DISTINCT drive_model FROM test_runs WHERE drive_model IS NOT NULL ORDER BY drive_model"),
            ("drive_types", "SELECT DISTINCT drive_type FROM test_runs WHERE drive_type IS NOT NULL ORDER BY drive_type"),
            ("hostnames", "SELECT DISTINCT hostname FROM test_runs WHERE hostname IS NOT NULL ORDER BY hostname"),
            ("protocols", "SELECT DISTINCT protocol FROM test_runs WHERE protocol IS NOT NULL ORDER BY protocol"),
            ("host_disk_combinations", "SELECT DISTINCT (hostname || ' - ' || protocol || ' - ' || drive_model) as host_disk_combo FROM test_runs WHERE hostname IS NOT NULL AND protocol IS NOT NULL AND drive_model IS NOT NULL ORDER BY host_disk_combo"),
            ("block_sizes", "SELECT DISTINCT block_size FROM test_runs WHERE block_size IS NOT NULL ORDER BY block_size"),
            ("patterns", "SELECT DISTINCT read_write_pattern FROM test_runs WHERE read_write_pattern IS NOT NULL ORDER BY read_write_pattern"),
            ("syncs", "SELECT DISTINCT sync FROM test_runs WHERE sync IS NOT NULL ORDER BY sync"),
            ("queue_depths", "SELECT DISTINCT queue_depth FROM test_runs WHERE queue_depth IS NOT NULL ORDER BY queue_depth"),
            ("directs", "SELECT DISTINCT direct FROM test_runs WHERE direct IS NOT NULL ORDER BY direct"),
            ("num_jobs", "SELECT DISTINCT num_jobs FROM test_runs WHERE num_jobs IS NOT NULL ORDER BY num_jobs"),
            ("test_sizes", "SELECT DISTINCT test_size FROM test_runs WHERE test_size IS NOT NULL ORDER BY test_size"),
            ("durations", "SELECT DISTINCT duration FROM test_runs WHERE duration IS NOT NULL ORDER BY duration"),
        ]
        
        for filter_name, query in filter_queries:
            cursor.execute(query)
            values = [row[0] for row in cursor.fetchall()]
            filters[filter_name] = values
        
        log_info("Filter options retrieved successfully", {
            "request_id": request_id,
            "filter_counts": {k: len(v) for k, v in filters.items()},
            "total_filters": len(filters)
        })
        
        return filters
    
    except Exception as e:
        log_error("Error retrieving filter options", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve filter options")


@router.get("/info")
@router.get("/info/")  # Handle with trailing slash
async def get_api_info():
    """Get API information"""
    return {
        "name": "FIO Analyzer API",
        "version": "1.0.0", 
        "description": "API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring",
        "endpoints": 14,
        "documentation": "/docs"
    }