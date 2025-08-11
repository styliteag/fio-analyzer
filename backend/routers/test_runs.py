"""
Test runs API router
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body, File, Form, UploadFile
import sqlite3

from database.connection import get_db
from database.models import TestRun, BulkUpdateRequest, dataclass_to_dict
from auth.middleware import require_admin, require_auth, User
from utils.logging import log_info, log_error


router = APIRouter()


@router.get("/")
@router.get("")  # Handle route without trailing slash
async def get_test_runs(
    request: Request,
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames to filter"),
    drive_types: Optional[str] = Query(None, description="Comma-separated drive types to filter"),
    drive_models: Optional[str] = Query(None, description="Comma-separated drive models to filter"),  # ADDED
    protocols: Optional[str] = Query(None, description="Comma-separated protocols to filter"),
    patterns: Optional[str] = Query(None, description="Comma-separated patterns to filter"),
    block_sizes: Optional[str] = Query(None, description="Comma-separated block sizes to filter"),
    syncs: Optional[str] = Query(None, description="Comma-separated sync values to filter"),  # ADDED
    queue_depths: Optional[str] = Query(None, description="Comma-separated queue depths to filter"),  # ADDED
    directs: Optional[str] = Query(None, description="Comma-separated direct values to filter"),  # ADDED
    num_jobs: Optional[str] = Query(None, description="Comma-separated num_jobs values to filter"),  # ADDED
    test_sizes: Optional[str] = Query(None, description="Comma-separated test sizes to filter"),  # ADDED
    durations: Optional[str] = Query(None, description="Comma-separated durations to filter"),  # ADDED
    limit: int = Query(50, ge=1, le=1000, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    user: User = Depends(require_admin),
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
        
        # ADDED: drive_models filter
        if drive_models:
            drive_model_list = [d.strip() for d in drive_models.split(',')]
            placeholders = ','.join(['?' for _ in drive_model_list])
            where_conditions.append(f"drive_model IN ({placeholders})")
            params.extend(drive_model_list)
        
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
        
        # ADDED: syncs filter (integer conversion)
        if syncs:
            sync_list = [int(s.strip()) for s in syncs.split(',')]
            placeholders = ','.join(['?' for _ in sync_list])
            where_conditions.append(f"sync IN ({placeholders})")
            params.extend(sync_list)
        
        # ADDED: queue_depths filter (integer conversion)
        if queue_depths:
            queue_depth_list = [int(q.strip()) for q in queue_depths.split(',')]
            placeholders = ','.join(['?' for _ in queue_depth_list])
            where_conditions.append(f"queue_depth IN ({placeholders})")
            params.extend(queue_depth_list)
        
        # ADDED: directs filter (integer conversion)
        if directs:
            direct_list = [int(d.strip()) for d in directs.split(',')]
            placeholders = ','.join(['?' for _ in direct_list])
            where_conditions.append(f"direct IN ({placeholders})")
            params.extend(direct_list)
        
        # ADDED: num_jobs filter (integer conversion)
        if num_jobs:
            num_jobs_list = [int(n.strip()) for n in num_jobs.split(',')]
            placeholders = ','.join(['?' for _ in num_jobs_list])
            where_conditions.append(f"num_jobs IN ({placeholders})")
            params.extend(num_jobs_list)
        
        # ADDED: test_sizes filter
        if test_sizes:
            test_size_list = [s.strip() for s in test_sizes.split(',')]
            placeholders = ','.join(['?' for _ in test_size_list])
            where_conditions.append(f"test_size IN ({placeholders})")
            params.extend(test_size_list)
        
        # ADDED: durations filter (integer conversion)
        if durations:
            duration_list = [int(d.strip()) for d in durations.split(',')]
            placeholders = ','.join(['?' for _ in duration_list])
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
                   avg_latency, bandwidth, iops, p95_latency, p99_latency
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
            test_run_data['block_size'] = str(test_run_data['block_size'])  # Ensure string
            test_runs.append(test_run_data)
        
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
        
        # Frontend expects direct array of test runs, not wrapped object
        return test_runs
    
    except Exception as e:
        log_error("Error retrieving test runs", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve test runs")


@router.put("/bulk")
@router.put("/bulk/")  # Handle with trailing slash
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
        from dataclasses import asdict
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
        
        return {
            "message": f"Successfully updated {updated} test runs",
            "updated": updated,
            "failed": len(bulk_request.test_run_ids) - updated
        }
    
    except Exception as e:
        log_error("Error during bulk update", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update test runs")


@router.get("/performance-data")
@router.get("/performance-data/")  # Handle with trailing slash
async def get_performance_data(
    request: Request,
    test_run_ids: str = Query(..., description="Comma-separated test run IDs"),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get performance data for specific test runs"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Parse parameters
        test_run_id_list = [int(id.strip()) for id in test_run_ids.split(',')]
        
        # Build query
        placeholders = ','.join(['?' for _ in test_run_id_list])
        cursor = db.cursor()
        
        results = []
        for test_run_id in test_run_id_list:
            cursor.execute("""
                SELECT id, timestamp, drive_model, drive_type, test_name, description,
                       block_size, read_write_pattern, queue_depth, duration,
                       fio_version, job_runtime, rwmixread, total_ios_read, 
                       total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                       uploaded_file_path, output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                       avg_latency, bandwidth, iops, p95_latency, p99_latency
                FROM test_runs WHERE id = ?
            """, (test_run_id,))
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
                    "metrics": {
                        "avg_latency": {"value": test_run_data["avg_latency"], "unit": "ms"} if test_run_data["avg_latency"] is not None else None,
                        "bandwidth": {"value": test_run_data["bandwidth"], "unit": "MB/s"} if test_run_data["bandwidth"] is not None else None,
                        "iops": {"value": test_run_data["iops"], "unit": "IOPS"} if test_run_data["iops"] is not None else None,
                        "p95_latency": {"value": test_run_data["p95_latency"], "unit": "ms"} if test_run_data["p95_latency"] is not None else None,
                        "p99_latency": {"value": test_run_data["p99_latency"], "unit": "ms"} if test_run_data["p99_latency"] is not None else None
                    }
                }
                
                results.append(result)
        
        log_info("Performance data retrieved successfully", {
            "request_id": request_id,
            "test_run_ids": test_run_id_list,
            "results_count": len(results)
        })
        
        return results
    
    except Exception as e:
        log_error("Error retrieving performance data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve performance data")


@router.get("/{test_run_id}")
async def get_test_run(
    request: Request,
    test_run_id: int,
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get a single test run by ID"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT id, timestamp, drive_model, drive_type, test_name, description,
                   block_size, read_write_pattern, queue_depth, duration,
                   fio_version, job_runtime, rwmixread, total_ios_read, 
                   total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                   output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                   avg_latency, bandwidth, iops, p95_latency, p99_latency
            FROM test_runs WHERE id = ?
        """, (test_run_id,))
        
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        test_run_data = dict(row)
        test_run_data['block_size'] = str(test_run_data['block_size'])  # Ensure string
        
        log_info("Test run retrieved successfully", {
            "request_id": request_id,
            "test_run_id": test_run_id
        })
        
        return test_run_data
    
    except HTTPException:
        raise
    except Exception as e:
        log_error("Error retrieving test run", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve test run")


@router.put("/{test_run_id}")
async def update_test_run(
    request: Request,
    test_run_id: int,
    update_data: dict = Body(...),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db)
):
    """Update a test run"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Define allowed fields for validation
        allowed_fields = ['description', 'test_name', 'hostname', 'protocol', 'drive_type', 'drive_model']
        submitted_fields = list(update_data.keys())
        
        # Check for invalid fields
        invalid_fields = [field for field in submitted_fields if field not in allowed_fields]
        if invalid_fields:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid fields: {', '.join(invalid_fields)}. Allowed fields: {', '.join(allowed_fields)}"
            )
        
        # Simple validation
        validation = {
            'hostname': {'maxLength': 255},
            'protocol': {'maxLength': 100},
            'description': {'maxLength': 1000},
            'test_name': {'maxLength': 500},
            'drive_type': {'maxLength': 100},
            'drive_model': {'maxLength': 255}
        }
        
        for field, value in update_data.items():
            if value and field in validation and len(str(value)) > validation[field]['maxLength']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Field '{field}' exceeds maximum length of {validation[field]['maxLength']} characters"
                )
        
        # Build update query
        cursor = db.cursor()
        
        # Update test_runs table
        cursor.execute("""
            UPDATE test_runs 
            SET description = COALESCE(?, description),
                test_name = COALESCE(?, test_name),
                hostname = COALESCE(?, hostname),
                protocol = COALESCE(?, protocol),
                drive_type = COALESCE(?, drive_type),
                drive_model = COALESCE(?, drive_model)
            WHERE id = ?
        """, [
            update_data.get('description'),
            update_data.get('test_name'),
            update_data.get('hostname'),
            update_data.get('protocol'),
            update_data.get('drive_type'),
            update_data.get('drive_model'),
            test_run_id
        ])
        
        latest_updated = cursor.rowcount
        
        # Also update test_runs_all table
        cursor.execute("""
            UPDATE test_runs_all 
            SET description = COALESCE(?, description),
                test_name = COALESCE(?, test_name),
                hostname = COALESCE(?, hostname),
                protocol = COALESCE(?, protocol),
                drive_type = COALESCE(?, drive_type),
                drive_model = COALESCE(?, drive_model)
            WHERE id = ?
        """, [
            update_data.get('description'),
            update_data.get('test_name'),
            update_data.get('hostname'),
            update_data.get('protocol'),
            update_data.get('drive_type'),
            update_data.get('drive_model'),
            test_run_id
        ])
        
        db.commit()
        
        if latest_updated == 0:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        log_info("Test run updated successfully", {
            "request_id": request_id,
            "user": user.username,
            "test_run_id": test_run_id,
            "updated_fields": submitted_fields,
            "changes": update_data
        })
        
        return {"message": "Test run updated successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating test run", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to update test run")


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