"""
Import API router
"""

import json
import uuid
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from datetime import datetime
import sqlite3

from database.connection import get_db, db_manager
from database.models import ImportResponse
from auth.middleware import require_auth, User
from utils.logging import log_info, log_error
from config.settings import settings


router = APIRouter()


@router.post("/", response_model=ImportResponse)
async def import_fio_data(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Import FIO test data from uploaded file"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Validate file
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="Only JSON files are supported")
        
        if file.size and file.size > settings.max_upload_size:
            raise HTTPException(status_code=400, detail="File too large")
        
        # Read and parse JSON
        content = await file.read()
        try:
            fio_data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
        
        # Extract test run data from FIO JSON
        test_run_data = extract_test_run_data(fio_data, file.filename)
        
        # Update latest flags
        await db_manager.update_latest_flags(test_run_data)
        
        # Insert into database
        test_run_id = insert_test_run(db, test_run_data)
        
        # Save uploaded file
        file_path = save_uploaded_file(content, file.filename, test_run_data)
        
        # Update file path in database
        cursor = db.cursor()
        cursor.execute("UPDATE test_runs SET uploaded_file_path = ? WHERE id = ?", (str(file_path), test_run_id))
        cursor.execute("UPDATE test_runs_all SET uploaded_file_path = ? WHERE id = ?", (str(file_path), test_run_id))
        db.commit()
        
        log_info("FIO data imported successfully", {
            "request_id": request_id,
            "user": user.username,
            "filename": file.filename,
            "test_run_id": test_run_id,
            "hostname": test_run_data.get("hostname"),
            "test_name": test_run_data.get("test_name")
        })
        
        return ImportResponse(
            message="FIO data imported successfully",
            test_run_id=test_run_id,
            filename=file.filename
        )
    
    except HTTPException:
        raise
    except Exception as e:
        log_error("Error importing FIO data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to import FIO data")


def extract_test_run_data(fio_data: Dict[str, Any], filename: str) -> Dict[str, Any]:
    """Extract test run data from FIO JSON"""
    jobs = fio_data.get("jobs", [])
    if not jobs:
        raise HTTPException(status_code=400, detail="No jobs found in FIO data")
    
    job = jobs[0]  # Use first job
    
    # Extract basic information
    test_run_data = {
        "timestamp": datetime.now().isoformat(),
        "test_date": datetime.now().isoformat(),
        "fio_version": fio_data.get("fio_version", "unknown"),
        "job_runtime": job.get("job_runtime", 0),
        "duration": job.get("duration", 0) // 1000,  # Convert to seconds
        "test_name": job.get("jobname", "unknown"),
        
        # Extract from job options
        "block_size": job.get("job_options", {}).get("bs", "4K"),
        "read_write_pattern": job.get("job_options", {}).get("rw", "read"),
        "queue_depth": int(job.get("job_options", {}).get("iodepth", 1)),
        "output_file": job.get("job_options", {}).get("filename", "testfile"),
        "num_jobs": int(job.get("job_options", {}).get("numjobs", 1)),
        "direct": int(job.get("job_options", {}).get("direct", 0)),
        "test_size": job.get("job_options", {}).get("size", "1M"),
        "sync": int(job.get("job_options", {}).get("sync", 0)),
        "iodepth": int(job.get("job_options", {}).get("iodepth", 1)),
        
        # Extract performance metrics
        "iops": extract_iops(job),
        "avg_latency": extract_latency(job),
        "bandwidth": extract_bandwidth(job),
        "p95_latency": extract_percentile_latency(job, 95),
        "p99_latency": extract_percentile_latency(job, 99),
        
        # Extract system info
        "usr_cpu": fio_data.get("usr_cpu", 0),
        "sys_cpu": fio_data.get("sys_cpu", 0),
        
        # Set defaults
        "hostname": "unknown",
        "protocol": "Local",
        "drive_type": "Unknown",
        "drive_model": "Unknown",
        "description": f"Imported from {filename}",
        "is_latest": 1
    }
    
    return test_run_data


def extract_iops(job: Dict[str, Any]) -> float:
    """Extract IOPS from job data"""
    read_iops = job.get("read", {}).get("iops", 0)
    write_iops = job.get("write", {}).get("iops", 0)
    return read_iops + write_iops


def extract_latency(job: Dict[str, Any]) -> float:
    """Extract average latency from job data"""
    read_lat = job.get("read", {}).get("lat_ns", {}).get("mean", 0)
    write_lat = job.get("write", {}).get("lat_ns", {}).get("mean", 0)
    
    # Convert nanoseconds to milliseconds
    total_ios = job.get("read", {}).get("io_ops", 0) + job.get("write", {}).get("io_ops", 0)
    if total_ios == 0:
        return 0.0
    
    read_ios = job.get("read", {}).get("io_ops", 0)
    write_ios = job.get("write", {}).get("io_ops", 0)
    
    weighted_lat = (read_lat * read_ios + write_lat * write_ios) / total_ios
    return weighted_lat / 1000000  # Convert ns to ms


def extract_bandwidth(job: Dict[str, Any]) -> float:
    """Extract bandwidth from job data"""
    read_bw = job.get("read", {}).get("bw_bytes", 0)
    write_bw = job.get("write", {}).get("bw_bytes", 0)
    return (read_bw + write_bw) / (1024 * 1024)  # Convert to MB/s


def extract_percentile_latency(job: Dict[str, Any], percentile: int) -> float:
    """Extract percentile latency from job data"""
    read_lat = job.get("read", {}).get("clat_ns", {}).get("percentile", {}).get(f"{percentile}.000000", 0)
    write_lat = job.get("write", {}).get("clat_ns", {}).get("percentile", {}).get(f"{percentile}.000000", 0)
    
    # Use the higher of read/write latency
    max_lat = max(read_lat, write_lat)
    return max_lat / 1000000  # Convert ns to ms


def insert_test_run(db: sqlite3.Connection, test_run_data: Dict[str, Any]) -> int:
    """Insert test run into database"""
    cursor = db.cursor()
    
    # Define columns and values
    columns = [
        "timestamp", "test_date", "drive_model", "drive_type", "test_name",
        "block_size", "read_write_pattern", "queue_depth", "duration",
        "fio_version", "job_runtime", "rwmixread", "total_ios_read", "total_ios_write",
        "usr_cpu", "sys_cpu", "hostname", "protocol", "description",
        "output_file", "num_jobs", "direct", "test_size", "sync", "iodepth",
        "avg_latency", "bandwidth", "iops", "p95_latency", "p99_latency", "is_latest"
    ]
    
    values = [test_run_data.get(col) for col in columns]
    placeholders = ", ".join(["?" for _ in columns])
    
    # Insert into test_runs_all
    cursor.execute(f"INSERT INTO test_runs_all ({', '.join(columns)}) VALUES ({placeholders})", values)
    
    # Insert into test_runs (with conflict resolution)
    cursor.execute(f"INSERT OR REPLACE INTO test_runs ({', '.join(columns)}) VALUES ({placeholders})", values)
    test_run_id = cursor.lastrowid
    
    db.commit()
    return test_run_id


def save_uploaded_file(content: bytes, filename: str, test_run_data: Dict[str, Any]) -> str:
    """Save uploaded file to disk"""
    import os
    from pathlib import Path
    
    # Create directory structure
    hostname = test_run_data.get("hostname", "unknown")
    protocol = test_run_data.get("protocol", "unknown")
    timestamp = datetime.now()
    
    dir_path = (
        settings.upload_dir / 
        hostname / 
        protocol / 
        timestamp.strftime("%Y-%m-%d") / 
        timestamp.strftime("%H-%M")
    )
    
    dir_path.mkdir(parents=True, exist_ok=True)
    
    # Save file
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = dir_path / unique_filename
    
    with open(file_path, 'wb') as f:
        f.write(content)
    
    return str(file_path)