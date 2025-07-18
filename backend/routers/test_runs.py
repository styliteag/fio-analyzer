"""
Test runs API router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
import sqlite3

from database.connection import get_db
from database.models import TestRun, BulkUpdateRequest, BulkUpdateResponse
from auth.middleware import require_admin, User
from utils.logging import log_info, log_error


router = APIRouter()


class TestRunsResponse(BaseModel):
    """Test runs response model"""
    test_runs: List[TestRun]
    total: int
    page: int
    per_page: int


@router.get("/", response_model=TestRunsResponse)
async def get_test_runs(
    request: Request,
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames to filter"),
    drive_types: Optional[str] = Query(None, description="Comma-separated drive types to filter"),
    protocols: Optional[str] = Query(None, description="Comma-separated protocols to filter"),
    patterns: Optional[str] = Query(None, description="Comma-separated patterns to filter"),
    block_sizes: Optional[str] = Query(None, description="Comma-separated block sizes to filter"),
    limit: int = Query(50, ge=1, le=1000, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get test runs with optional filtering"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Build WHERE clause
        where_conditions = []
        params = []
        
        if hostnames:
            hostname_list = [h.strip() for h in hostnames.split(',')]
            placeholders = ','.join(['?' for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)
        
        if drive_types:
            drive_type_list = [d.strip() for d in drive_types.split(',')]
            placeholders = ','.join(['?' for _ in drive_type_list])
            where_conditions.append(f"drive_type IN ({placeholders})")
            params.extend(drive_type_list)
        
        if protocols:
            protocol_list = [p.strip() for p in protocols.split(',')]
            placeholders = ','.join(['?' for _ in protocol_list])
            where_conditions.append(f"protocol IN ({placeholders})")
            params.extend(protocol_list)
        
        if patterns:
            pattern_list = [p.strip() for p in patterns.split(',')]
            placeholders = ','.join(['?' for _ in pattern_list])
            where_conditions.append(f"read_write_pattern IN ({placeholders})")
            params.extend(pattern_list)
        
        if block_sizes:
            block_size_list = [b.strip() for b in block_sizes.split(',')]
            placeholders = ','.join(['?' for _ in block_size_list])
            where_conditions.append(f"block_size IN ({placeholders})")
            params.extend(block_size_list)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Get total count
        cursor = db.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM test_runs WHERE {where_clause}", params)
        total = cursor.fetchone()[0]
        
        # Get test runs
        query = f"""
            SELECT * FROM test_runs 
            WHERE {where_clause} 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])
        rows = cursor.fetchall()
        
        # Convert to TestRun objects
        test_runs = []
        for row in rows:
            test_run_data = dict(row)
            test_run_data['block_size'] = str(test_run_data['block_size'])  # Ensure string
            test_runs.append(TestRun(**test_run_data))
        
        log_info("Test runs retrieved successfully", {
            "request_id": request_id,
            "total": total,
            "returned": len(test_runs),
            "filters": {
                "hostnames": hostnames,
                "drive_types": drive_types,
                "protocols": protocols,
                "patterns": patterns,
                "block_sizes": block_sizes
            }
        })
        
        return TestRunsResponse(
            test_runs=test_runs,
            total=total,
            page=offset // limit + 1,
            per_page=limit
        )
    
    except Exception as e:
        log_error("Error retrieving test runs", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve test runs")


@router.put("/bulk", response_model=BulkUpdateResponse)
async def bulk_update_test_runs(
    request: Request,
    bulk_request: BulkUpdateRequest,
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db)
):
    """Bulk update test run metadata"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Validate that we have updates to apply
        updates = bulk_request.updates.dict(exclude_none=True)
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        # Build update query
        set_clauses = []
        params = []
        
        for field, value in updates.items():
            set_clauses.append(f"{field} = ?")
            params.append(value)
        
        set_clause = ", ".join(set_clauses)
        placeholders = ','.join(['?' for _ in bulk_request.test_run_ids])
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
        cursor.execute(f"""
            UPDATE test_runs_all 
            SET {set_clause} 
            WHERE id IN ({placeholders})
        """, params)
        
        db.commit()
        
        log_info("Bulk update completed successfully", {
            "request_id": request_id,
            "user": user.username,
            "updated": updated,
            "test_run_ids": bulk_request.test_run_ids,
            "updates": updates
        })
        
        return BulkUpdateResponse(
            message=f"Successfully updated {updated} test runs",
            updated=updated,
            failed=len(bulk_request.test_run_ids) - updated
        )
    
    except Exception as e:
        log_error("Error during bulk update", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update test runs")


@router.get("/performance-data")
async def get_performance_data(
    request: Request,
    test_run_ids: str = Query(..., description="Comma-separated test run IDs"),
    metric_types: str = Query(..., description="Comma-separated metric types"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get performance data for specific test runs"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Parse parameters
        test_run_id_list = [int(id.strip()) for id in test_run_ids.split(',')]
        metric_type_list = [m.strip() for m in metric_types.split(',')]
        
        # Build query
        placeholders = ','.join(['?' for _ in test_run_id_list])
        cursor = db.cursor()
        
        results = []
        for test_run_id in test_run_id_list:
            cursor.execute("SELECT * FROM test_runs WHERE id = ?", (test_run_id,))
            row = cursor.fetchone()
            
            if row:
                test_run_data = dict(row)
                performance_data = {
                    "test_run_id": test_run_id,
                    "metrics": {}
                }
                
                # Extract requested metrics
                for metric_type in metric_type_list:
                    if metric_type in test_run_data and test_run_data[metric_type] is not None:
                        performance_data["metrics"][metric_type] = {
                            "value": test_run_data[metric_type],
                            "unit": get_metric_unit(metric_type)
                        }
                
                results.append(performance_data)
        
        log_info("Performance data retrieved successfully", {
            "request_id": request_id,
            "test_run_ids": test_run_id_list,
            "metric_types": metric_type_list,
            "results_count": len(results)
        })
        
        return {"performance_data": results}
    
    except Exception as e:
        log_error("Error retrieving performance data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve performance data")


@router.delete("/{test_run_id}")
async def delete_test_run(
    request: Request,
    test_run_id: int,
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db)
):
    """Delete a test run"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
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
        
        log_info("Test run deleted successfully", {
            "request_id": request_id,
            "user": user.username,
            "test_run_id": test_run_id,
            "latest_deleted": latest_deleted,
            "all_deleted": all_deleted
        })
        
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
        "p95_latency": "ms",
        "p99_latency": "ms",
        "bandwidth": "MB/s"
    }
    return units.get(metric_type, "")