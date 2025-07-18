"""
Utils API router
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
import sqlite3

from database.connection import get_db
from database.models import FilterOptions
from utils.logging import log_info, log_error


router = APIRouter()


@router.get("/filters", response_model=FilterOptions)
async def get_filters(
    request: Request,
    db: sqlite3.Connection = Depends(get_db)
):
    """Get available filter options"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        filters = FilterOptions()
        
        # Get distinct values for each filter
        filter_queries = [
            ("hostnames", "SELECT DISTINCT hostname FROM test_runs WHERE hostname IS NOT NULL ORDER BY hostname"),
            ("protocols", "SELECT DISTINCT protocol FROM test_runs WHERE protocol IS NOT NULL ORDER BY protocol"),
            ("drive_types", "SELECT DISTINCT drive_type FROM test_runs WHERE drive_type IS NOT NULL ORDER BY drive_type"),
            ("drive_models", "SELECT DISTINCT drive_model FROM test_runs WHERE drive_model IS NOT NULL ORDER BY drive_model"),
            ("block_sizes", "SELECT DISTINCT block_size FROM test_runs WHERE block_size IS NOT NULL ORDER BY block_size"),
            ("patterns", "SELECT DISTINCT read_write_pattern FROM test_runs WHERE read_write_pattern IS NOT NULL ORDER BY read_write_pattern"),
        ]
        
        for filter_name, query in filter_queries:
            cursor.execute(query)
            values = [row[0] for row in cursor.fetchall()]
            setattr(filters, filter_name, values)
        
        log_info("Filter options retrieved successfully", {
            "request_id": request_id,
            "hostnames_count": len(filters.hostnames),
            "protocols_count": len(filters.protocols),
            "drive_types_count": len(filters.drive_types),
            "drive_models_count": len(filters.drive_models),
            "block_sizes_count": len(filters.block_sizes),
            "patterns_count": len(filters.patterns)
        })
        
        return filters
    
    except Exception as e:
        log_error("Error retrieving filter options", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve filter options")