"""
Import API router
"""

import json
import uuid
import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Body
from datetime import datetime, timezone
import sqlite3
from pathlib import Path

from database.connection import get_db, db_manager
# Removed ImportResponse import - using plain dictionaries
from auth.middleware import require_uploader, require_admin, User
from utils.logging import log_info, log_error
from config.settings import settings


router = APIRouter()


@router.post(
    "/",
    summary="Import FIO Test Data",
    description="Upload and import FIO benchmark results from a JSON file",
    response_description="Import operation results with new test run information",
    responses={
        200: {
            "description": "FIO data imported successfully",
            "content": {
                "application/json": {
                    "example": {
                        "message": "FIO data imported successfully",
                        "test_run_id": 42,
                        "filename": "fio_results_2025-06-31.json"
                    }
                }
            }
        },
        400: {
            "description": "Invalid file format, file too large, or malformed JSON",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_format": {
                            "summary": "Invalid file format",
                            "value": {"error": "Only JSON files are supported"}
                        },
                        "file_too_large": {
                            "summary": "File size exceeded",
                            "value": {"error": "File too large"}
                        },
                        "invalid_json": {
                            "summary": "Malformed JSON",
                            "value": {"error": "Invalid JSON format: Expecting ',' delimiter"}
                        }
                    }
                }
            }
        },
        401: {"description": "Authentication required"},
        403: {"description": "Upload permission required"},
        500: {"description": "Internal server error during import"}
    }
)
@router.post(
    "",
    include_in_schema=False
)  # Handle route without trailing slash but hide from docs
async def import_fio_data(
    request: Request,
    file: UploadFile = File(
        ...,
        description="FIO JSON output file to import. Must be valid JSON format.",
        media_type="application/json"
    ),
    drive_model: str = Form(
        ...,
        description="Storage drive model name",
        example="Samsung SSD 980 PRO",
        max_length=255
    ),
    drive_type: str = Form(
        ...,
        description="Storage technology type",
        example="NVMe",
        max_length=100
    ),
    hostname: str = Form(
        ...,
        description="Server hostname where the test was executed",
        example="server-01",
        max_length=255
    ),
    protocol: str = Form(
        ...,
        description="Storage access protocol",
        example="Local",
        max_length=100
    ),
    description: str = Form(
        ...,
        description="Human-readable description of the test",
        example="4K random read performance baseline test",
        max_length=1000
    ),
    date: Optional[str] = Form(
        None,
        description="Test execution date in ISO format (YYYY-MM-DDTHH:MM:SS). Uses current timestamp if not provided.",
        example="2025-06-31T20:00:00"
    ),
    user: User = Depends(require_uploader),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Import FIO benchmark data from uploaded JSON files.
    
    This endpoint processes FIO JSON output files and extracts performance metrics,
    test configuration, and system information. The uploaded data is parsed and
    stored in the database for analysis and visualization.
    
    **Authentication Required:** Upload permission (admin or uploader role)
    
    **File Requirements:**
    - Must be valid JSON format
    - Must contain FIO job data structure
    - File size must not exceed configured limit
    - Must have .json extension
    
    **Extracted Metrics:**
    - IOPS (read/write operations per second)
    - Latency statistics (average, P95, P99)
    - Bandwidth measurements
    - System CPU utilization
    
    **Extracted Configuration:**
    - Block size and I/O pattern
    - Queue depth and job settings
    - Test duration and file size
    - Direct I/O and sync flags
    
    **Form Data:**
    All form fields are required except date. The metadata provided
    will override any corresponding values in the FIO JSON.
    
    **Note:** Uploaded files are stored on disk with metadata for
    future reference and potential re-import.
    """
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
        
        # Override with form data
        test_run_data.update({
            "drive_model": drive_model,
            "drive_type": drive_type,
            "hostname": hostname,
            "protocol": protocol,
            "description": description
        })
        
        # Set date if provided
        if date:
            test_run_data["test_date"] = date
        
        # Update latest flags
        await db_manager.update_latest_flags(test_run_data)
        
        # Save uploaded file
        file_path = save_uploaded_file(content, file.filename, test_run_data)
        
        # Create metadata file (matching Node.js behavior)
        metadata_path = create_metadata_file(file_path, test_run_data, user.username, file.filename)
        
        # Insert into database with file path
        test_run_id = insert_test_run(db, test_run_data, file_path)
        
        log_info("FIO data imported successfully", {
            "request_id": request_id,
            "user": user.username,
            "filename": file.filename,
            "test_run_id": test_run_id,
            "hostname": test_run_data.get("hostname"),
            "test_name": test_run_data.get("test_name"),
            "drive_model": test_run_data.get("drive_model"),
            "drive_type": test_run_data.get("drive_type")
        })
        
        return {
            "message": "FIO data imported successfully",
            "test_run_id": test_run_id,
            "filename": file.filename
        }
    
    except HTTPException:
        raise
    except Exception as e:
        log_error("Error importing FIO data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to import FIO data")


@router.post(
    "/bulk",
    summary="Bulk Import FIO Data",
    description="Import multiple FIO JSON files from the server uploads directory",
    response_description="Bulk import operation statistics and results",
    responses={
        200: {
            "description": "Bulk import completed with statistics",
            "content": {
                "application/json": {
                    "examples": {
                        "successful_import": {
                            "summary": "Successful bulk import",
                            "value": {
                                "message": "Bulk import completed: 25 files processed, 25 test runs imported",
                                "statistics": {
                                    "totalFiles": 30,
                                    "processedFiles": 25,
                                    "totalTestRuns": 25,
                                    "skippedFiles": 3,
                                    "errorFiles": 2
                                }
                            }
                        },
                        "dry_run_result": {
                            "summary": "Dry run with preview",
                            "value": {
                                "message": "Bulk import completed: 25 files processed, 0 test runs imported",
                                "statistics": {
                                    "totalFiles": 25,
                                    "processedFiles": 25,
                                    "totalTestRuns": 0,
                                    "skippedFiles": 0,
                                    "errorFiles": 0
                                },
                                "dryRunResults": [
                                    {
                                        "path": "/uploads/server-01/Local/2025-06-31/20-00/test.json",
                                        "metadata": {
                                            "hostname": "server-01",
                                            "protocol": "Local",
                                            "test_name": "randread_4k"
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        },
        400: {"description": "Invalid request parameters or uploads directory not found"},
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error during bulk import"}
    }
)
@router.post(
    "/bulk/",
    include_in_schema=False
)  # Handle with trailing slash but hide from docs
async def bulk_import_fio_data(
    request: Request,
    bulk_request: Dict[str, Any] = Body(
        ...,
        description="Bulk import configuration options",
        example={
            "overwrite": False,
            "dryRun": False
        }
    ),
    user: User = Depends(require_admin),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Import multiple FIO data files from the server uploads directory.
    
    This endpoint scans the uploads directory for JSON files and imports them
    automatically. It attempts to extract metadata from the file path structure
    and .info metadata files when available.
    
    **Authentication Required:** Admin access
    
    **Request Options:**
    - **overwrite** (boolean): Whether to overwrite existing test runs (default: false)
    - **dryRun** (boolean): Preview import without making changes (default: false)
    
    **File Discovery:**
    The system recursively searches for .json files in the uploads directory.
    Metadata is extracted from:
    1. Accompanying .info files (created during regular uploads)
    2. Directory structure: uploads/hostname/protocol/date/time/file.json
    3. FIO JSON content itself
    
    **Expected Directory Structure:**
    ```
    uploads/
    ├── server-01/
    │   ├── Local/
    │   │   └── 2025-06-31/
    │   │       └── 20-00/
    │   │           ├── test.json
    │   │           └── test.info
    ```
    
    **Dry Run Mode:**
    When dryRun is true, the endpoint will:
    - Scan and parse all files
    - Extract metadata
    - Return preview results
    - Not modify the database
    
    **Duplicate Handling:**
    Existing test runs are identified by matching:
    - hostname, protocol, drive_model, drive_type
    - block_size, read_write_pattern, queue_depth
    - test_name and file path
    """
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        # Extract options
        overwrite = bulk_request.get("overwrite", False)
        dry_run = bulk_request.get("dryRun", False)
        
        # Get uploads directory
        uploads_dir = settings.upload_dir
        if not uploads_dir.exists():
            raise HTTPException(status_code=400, detail="Uploads directory not found")
        
        # Find all JSON files recursively
        json_files = list(uploads_dir.rglob("*.json"))
        
        if not json_files:
            return {
                "message": "No JSON files found for bulk import",
                "statistics": {
                    "totalFiles": 0,
                    "processedFiles": 0,
                    "totalTestRuns": 0,
                    "skippedFiles": 0,
                    "errorFiles": 0
                }
            }
        
        processed_files = 0
        total_test_runs = 0
        skipped_files = 0
        error_files = 0
        dry_run_results = []
        
        for json_file in json_files:
            try:
                # Read and parse JSON file
                with open(json_file, 'r', encoding='utf-8') as f:
                    fio_data = json.load(f)
                
                # Try to read metadata from .info file first
                info_file = json_file.with_suffix('.info')
                metadata = {}
                if info_file.exists():
                    try:
                        with open(info_file, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                    except Exception as e:
                        log_error(f"Error reading .info file {info_file}", e, {"request_id": request_id})
                
                # If no .info file or failed to read, extract from file path
                if not metadata:
                    metadata = extract_metadata_from_path(json_file)
                
                # Extract test run data
                test_run_data = extract_test_run_data(fio_data, json_file.name)
                
                # Update metadata with path info
                test_run_data.update(metadata)
                
                # Use timestamp from .info file if available
                if metadata.get("upload_timestamp"):
                    test_run_data["timestamp"] = metadata["upload_timestamp"]
                    test_run_data["test_date"] = metadata.get("test_date", metadata["upload_timestamp"])
                
                if dry_run:
                    # For dry run, just collect metadata
                    dry_run_results.append({
                        "path": str(json_file),
                        "metadata": test_run_data
                    })
                    processed_files += 1
                else:
                    # Check if test run already exists with more specific criteria
                    cursor = db.cursor()
                    cursor.execute("""
                        SELECT id FROM test_runs_all 
                        WHERE hostname = ? AND protocol = ? AND drive_model = ? 
                        AND drive_type = ? AND block_size = ? AND read_write_pattern = ?
                        AND queue_depth = ? AND test_name = ? AND uploaded_file_path = ?
                    """, (
                        test_run_data.get("hostname"),
                        test_run_data.get("protocol"),
                        test_run_data.get("drive_model"),
                        test_run_data.get("drive_type"),
                        test_run_data.get("block_size"),
                        test_run_data.get("read_write_pattern"),
                        test_run_data.get("queue_depth"),
                        test_run_data.get("test_name"),
                        str(json_file)
                    ))
                    
                    existing = cursor.fetchone()
                    
                    if existing and not overwrite:
                        skipped_files += 1
                        continue
                    
                    # Update latest flags
                    await db_manager.update_latest_flags(test_run_data)
                    
                    # Insert into database with file path
                    test_run_id = insert_test_run(db, test_run_data, str(json_file))
                    total_test_runs += 1
                    processed_files += 1
                
            except Exception as e:
                log_error(f"Error processing file {json_file}", e, {"request_id": request_id})
                error_files += 1
        
        log_info("Bulk import completed", {
            "request_id": request_id,
            "user": user.username,
            "processed_files": processed_files,
            "total_test_runs": total_test_runs,
            "skipped_files": skipped_files,
            "error_files": error_files,
            "dry_run": dry_run
        })
        
        response = {
            "message": f"Bulk import completed: {processed_files} files processed, {total_test_runs} test runs imported",
            "statistics": {
                "totalFiles": len(json_files),
                "processedFiles": processed_files,
                "totalTestRuns": total_test_runs,
                "skippedFiles": skipped_files,
                "errorFiles": error_files
            }
        }
        
        if dry_run and dry_run_results:
            response["dryRunResults"] = dry_run_results
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        log_error("Error during bulk import", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to perform bulk import")


def extract_metadata_from_path(file_path: Path) -> Dict[str, Any]:
    """
    Extract metadata from file path structure.
    
    Attempts to parse hostname, protocol, and date information from
    the directory structure. Falls back to defaults if parsing fails.
    
    Expected structure: uploads/hostname/protocol/date/time/filename.json
    
    Args:
        file_path: Path object pointing to the JSON file
        
    Returns:
        Dictionary containing extracted metadata with fallback defaults
    """
    try:
        # Expected path structure: backend/uploads/hostname/protocol/date/time/filename.json
        parts = file_path.parts
        
        # Find the uploads directory in the path
        try:
            uploads_index = parts.index("uploads")
        except ValueError:
            # Try alternative path structure
            uploads_index = parts.index("upload")
        
        if len(parts) >= uploads_index + 5:
            hostname = parts[uploads_index + 1]
            protocol = parts[uploads_index + 2]
            date_str = parts[uploads_index + 3]
            time_str = parts[uploads_index + 4]
            
            return {
                "hostname": hostname,
                "protocol": protocol,
                "test_date": f"{date_str}T{time_str.replace('-', ':')}:00"
            }
    except (ValueError, IndexError):
        pass
    
    # Fallback to defaults
    return {
        "hostname": "unknown",
        "protocol": "Local",
        "test_date": datetime.now(timezone.utc).isoformat()
    }


def extract_test_run_data(fio_data: Dict[str, Any], filename: str) -> Dict[str, Any]:
    """
    Extract comprehensive test run data from FIO JSON output.
    
    Parses FIO JSON structure to extract test configuration, performance
    metrics, and system information. Handles both global options and
    job-specific settings.
    
    Args:
        fio_data: Parsed FIO JSON data structure
        filename: Original filename for reference
        
    Returns:
        Dictionary containing structured test run data
        
    Raises:
        HTTPException: If FIO data is invalid or missing required fields
    """
    jobs = fio_data.get("jobs", [])
    if not jobs:
        raise HTTPException(status_code=400, detail="No jobs found in FIO data")
    
    job = jobs[0]  # Use first job
    global_opts = fio_data.get("global options", {})
    job_opts = job.get("job options", {})
    
    # Extract basic information
    test_run_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "test_date": datetime.now(timezone.utc).isoformat(),
        "fio_version": fio_data.get("fio version", "unknown"),
        "job_runtime": job.get("job_runtime", 0),
        "duration": job.get("duration", 0) // 1000,  # Convert to seconds
        "test_name": job.get("jobname", "unknown"),
        
        # Extract from job options (matching Node.js logic)
        "block_size": (job_opts.get("bs") or global_opts.get("bs") or "4k").upper(),
        "read_write_pattern": job_opts.get("rw") or global_opts.get("rw") or "read",
        "queue_depth": int(job_opts.get("iodepth") or global_opts.get("iodepth") or 1),
        "output_file": job_opts.get("filename") or global_opts.get("filename") or "testfile",
        "num_jobs": int(job_opts.get("numjobs") or global_opts.get("numjobs") or 1),
        "direct": int(job_opts.get("direct") or global_opts.get("direct") or 0),
        "test_size": job_opts.get("size") or global_opts.get("size") or "1M",
        "sync": int(job_opts.get("sync") or global_opts.get("sync") or 0),
        "iodepth": int(job_opts.get("iodepth") or global_opts.get("iodepth") or 1),
        
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
    """
    Extract total IOPS (Input/Output Operations Per Second) from FIO job data.
    
    Combines read and write IOPS for total throughput measurement.
    
    Args:
        job: FIO job data containing read/write statistics
        
    Returns:
        Combined read + write IOPS value
    """
    read_iops = job.get("read", {}).get("iops", 0)
    write_iops = job.get("write", {}).get("iops", 0)
    return read_iops + write_iops


def extract_latency(job: Dict[str, Any]) -> float:
    """
    Extract weighted average latency from FIO job data.
    
    Calculates the I/O weighted average latency across read and write
    operations, converting from nanoseconds to milliseconds.
    
    Args:
        job: FIO job data containing latency statistics
        
    Returns:
        Weighted average latency in milliseconds
    """
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
    """
    Extract total bandwidth from FIO job data.
    
    Combines read and write bandwidth measurements and converts
    from bytes per second to megabytes per second.
    
    Args:
        job: FIO job data containing bandwidth statistics
        
    Returns:
        Combined bandwidth in MB/s
    """
    read_bw = job.get("read", {}).get("bw_bytes", 0)
    write_bw = job.get("write", {}).get("bw_bytes", 0)
    return (read_bw + write_bw) / (1024 * 1024)  # Convert to MB/s


def extract_percentile_latency(job: Dict[str, Any], percentile: int) -> float:
    """
    Extract percentile latency statistics from FIO job data.
    
    Retrieves the specified percentile latency value (P95, P99, etc.)
    and converts from nanoseconds to milliseconds. Uses the higher
    value between read and write operations.
    
    Args:
        job: FIO job data containing latency percentile statistics
        percentile: Percentile value to extract (e.g., 95 for P95)
        
    Returns:
        Percentile latency in milliseconds
    """
    read_lat = job.get("read", {}).get("clat_ns", {}).get("percentile", {}).get(f"{percentile}.000000", 0)
    write_lat = job.get("write", {}).get("clat_ns", {}).get("percentile", {}).get(f"{percentile}.000000", 0)
    
    # Use the higher of read/write latency
    max_lat = max(read_lat, write_lat)
    return max_lat / 1000000  # Convert ns to ms


def insert_test_run(db: sqlite3.Connection, test_run_data: Dict[str, Any], file_path: str = None) -> int:
    """
    Insert test run data into both current and historical database tables.
    
    Stores the test run in both test_runs (latest) and test_runs_all
    (historical) tables. Updates file path references if provided.
    
    Args:
        db: Database connection
        test_run_data: Complete test run data dictionary
        file_path: Optional path to the source JSON file
        
    Returns:
        ID of the inserted test run from the test_runs table
    """
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
    
    # Insert into test_runs_all first
    cursor.execute(f"INSERT INTO test_runs_all ({', '.join(columns)}) VALUES ({placeholders})", values)
    test_run_all_id = cursor.lastrowid
    
    # Insert into test_runs (with conflict resolution)
    cursor.execute(f"INSERT OR REPLACE INTO test_runs ({', '.join(columns)}) VALUES ({placeholders})", values)
    test_run_id = cursor.lastrowid
    
    # Update file path in both tables if provided
    if file_path:
        cursor.execute("UPDATE test_runs SET uploaded_file_path = ? WHERE id = ?", (str(file_path), test_run_id))
        cursor.execute("UPDATE test_runs_all SET uploaded_file_path = ? WHERE id = ?", (str(file_path), test_run_all_id))
    
    db.commit()
    return test_run_id


def save_uploaded_file(content: bytes, filename: str, test_run_data: Dict[str, Any]) -> str:
    """
    Save uploaded file to organized directory structure on disk.
    
    Creates a structured directory hierarchy based on hostname, protocol,
    and timestamp. Generates unique filenames to prevent conflicts.
    
    Directory structure: uploads/hostname/protocol/YYYY-MM-DD/HH-MM/
    
    Args:
        content: Raw file content bytes
        filename: Original filename
        test_run_data: Test metadata for directory organization
        
    Returns:
        Full path to the saved file
    """
    import os
    from pathlib import Path
    
    # Create directory structure
    hostname = test_run_data.get("hostname", "unknown")
    protocol = test_run_data.get("protocol", "unknown")
    timestamp = datetime.now(timezone.utc)
    
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


def create_metadata_file(file_path: str, test_run_data: Dict[str, Any], username: str, original_filename: str) -> str:
    """
    Create a metadata (.info) file alongside the uploaded JSON file.
    
    Stores upload metadata for future bulk import operations and audit trails.
    The metadata file enables reconstruction of upload context during bulk imports.
    
    Args:
        file_path: Path to the uploaded JSON file
        test_run_data: Test run metadata
        username: Username who uploaded the file
        original_filename: Original name of the uploaded file
        
    Returns:
        Path to the created metadata file
    """
    from pathlib import Path
    
    # Convert file_path to Path object
    json_path = Path(file_path)
    
    # Create metadata file path with .info extension
    metadata_path = json_path.with_suffix('.info')
    
    # Prepare metadata (matching Node.js structure)
    metadata = {
        "drive_model": test_run_data.get("drive_model"),
        "drive_type": test_run_data.get("drive_type"),
        "hostname": test_run_data.get("hostname"),
        "protocol": test_run_data.get("protocol"),
        "description": test_run_data.get("description"),
        "test_date": test_run_data.get("test_date"),
        "upload_timestamp": datetime.now(timezone.utc).isoformat(),
        "original_filename": original_filename,
        "uploaded_by": username
    }
    
    # Write metadata file
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    log_info("Metadata file created", {
        "metadata_path": str(metadata_path),
        "metadata_keys": list(metadata.keys())
    })
    
    return str(metadata_path)