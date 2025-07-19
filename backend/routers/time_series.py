"""
Time series API router
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from datetime import datetime, timedelta
import sqlite3

from database.connection import get_db
from database.models import TrendData
from auth.middleware import require_auth, User
from utils.logging import log_info, log_error


router = APIRouter()


@router.get("/servers")
@router.get("/servers/")  # Handle with trailing slash
async def get_servers(
    request: Request,
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get list of servers with test data"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        
        # Get server information aggregated by hostname (matching Node.js behavior)
        cursor.execute("""
            SELECT
                hostname,
                COUNT(*) AS config_count,
                SUM(run_count) AS total_runs,
                MAX(last_test_time) AS last_test_time,
                MIN(first_test_time) AS first_test_time
            FROM (
                SELECT
                    hostname,
                    COUNT(*) AS run_count,
                    MAX(timestamp) AS last_test_time,
                    MIN(timestamp) AS first_test_time
                FROM test_runs_all
                WHERE hostname IS NOT NULL
                  AND protocol IS NOT NULL
                  AND drive_model IS NOT NULL
                GROUP BY
                    hostname,
                    protocol,
                    drive_model,
                    drive_type,
                    read_write_pattern,
                    block_size,
                    queue_depth,
                    num_jobs,
                    direct,
                    test_size,
                    sync,
                    iodepth
            ) AS grouped
            GROUP BY hostname
            ORDER BY last_test_time DESC
        """)
        
        servers = []
        for row in cursor.fetchall():
            servers.append({
                "hostname": row[0],
                "config_count": row[1],
                "total_runs": row[2],
                "last_test_time": row[3],
                "first_test_time": row[4]
            })
        
        log_info("Servers retrieved successfully", {
            "request_id": request_id,
            "server_count": len(servers)
        })
        
        return servers
    
    except Exception as e:
        log_error("Error retrieving servers", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve servers")


@router.get("/all")
@router.get("/all/")  # Handle with trailing slash
async def get_all_time_series(
    request: Request,
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames"),
    protocols: Optional[str] = Query(None, description="Comma-separated protocols"),
    drive_types: Optional[str] = Query(None, description="Comma-separated drive types"),
    drive_models: Optional[str] = Query(None, description="Comma-separated drive models"),
    patterns: Optional[str] = Query(None, description="Comma-separated patterns"),
    block_sizes: Optional[str] = Query(None, description="Comma-separated block sizes"),
    syncs: Optional[str] = Query(None, description="Comma-separated sync values"),
    queue_depths: Optional[str] = Query(None, description="Comma-separated queue depths"),
    directs: Optional[str] = Query(None, description="Comma-separated direct values"),
    num_jobs: Optional[str] = Query(None, description="Comma-separated num_jobs values"),
    test_sizes: Optional[str] = Query(None, description="Comma-separated test sizes"),
    durations: Optional[str] = Query(None, description="Comma-separated durations"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get all historical time series data with filtering"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        
        # Build WHERE conditions
        where_conditions = []
        params = []
        
        if hostnames:
            hostname_list = [h.strip() for h in hostnames.split(',')]
            placeholders = ','.join(['?' for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)
        
        if protocols:
            protocol_list = [p.strip() for p in protocols.split(',')]
            placeholders = ','.join(['?' for _ in protocol_list])
            where_conditions.append(f"protocol IN ({placeholders})")
            params.extend(protocol_list)
        
        if drive_types:
            drive_type_list = [d.strip() for d in drive_types.split(',')]
            placeholders = ','.join(['?' for _ in drive_type_list])
            where_conditions.append(f"drive_type IN ({placeholders})")
            params.extend(drive_type_list)
        
        if drive_models:
            drive_model_list = [d.strip() for d in drive_models.split(',')]
            placeholders = ','.join(['?' for _ in drive_model_list])
            where_conditions.append(f"drive_model IN ({placeholders})")
            params.extend(drive_model_list)
        
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
        
        if syncs:
            sync_list = [int(s.strip()) for s in syncs.split(',')]
            placeholders = ','.join(['?' for _ in sync_list])
            where_conditions.append(f"sync IN ({placeholders})")
            params.extend(sync_list)
        
        if queue_depths:
            queue_depth_list = [int(q.strip()) for q in queue_depths.split(',')]
            placeholders = ','.join(['?' for _ in queue_depth_list])
            where_conditions.append(f"queue_depth IN ({placeholders})")
            params.extend(queue_depth_list)
        
        if directs:
            direct_list = [int(d.strip()) for d in directs.split(',')]
            placeholders = ','.join(['?' for _ in direct_list])
            where_conditions.append(f"direct IN ({placeholders})")
            params.extend(direct_list)
        
        if num_jobs:
            num_jobs_list = [int(n.strip()) for n in num_jobs.split(',')]
            placeholders = ','.join(['?' for _ in num_jobs_list])
            where_conditions.append(f"num_jobs IN ({placeholders})")
            params.extend(num_jobs_list)
        
        if test_sizes:
            test_size_list = [t.strip() for t in test_sizes.split(',')]
            placeholders = ','.join(['?' for _ in test_size_list])
            where_conditions.append(f"test_size IN ({placeholders})")
            params.extend(test_size_list)
        
        if durations:
            duration_list = [int(d.strip()) for d in durations.split(',')]
            placeholders = ','.join(['?' for _ in duration_list])
            where_conditions.append(f"duration IN ({placeholders})")
            params.extend(duration_list)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Get all historical data
        cursor.execute(f"""
            SELECT id, timestamp, drive_model, drive_type, test_name, description,
                   block_size, read_write_pattern, queue_depth, duration,
                   fio_version, job_runtime, rwmixread, total_ios_read, 
                   total_ios_write, usr_cpu, sys_cpu, hostname, protocol,
                   output_file, num_jobs, direct, test_size, sync, iodepth, is_latest,
                   avg_latency, bandwidth, iops, p95_latency, p99_latency
            FROM test_runs_all
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        # Convert to dictionaries
        results = []
        for row in cursor.fetchall():
            test_run_data = dict(row)
            test_run_data['block_size'] = str(test_run_data['block_size'])  # Ensure string
            results.append(test_run_data)
        
        log_info("All historical time series data retrieved successfully", {
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
                "durations": durations
            }
        })
        
        return results
    
    except Exception as e:
        log_error("Error retrieving all time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve all time series data")


@router.get("/latest")
@router.get("/latest/")  # Handle with trailing slash
async def get_latest_time_series(
    request: Request,
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get latest time series data"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        
        # Build query
        where_conditions = ["1=1"]
        params = []
        
        if hostnames:
            hostname_list = [h.strip() for h in hostnames.split(',')]
            placeholders = ','.join(['?' for _ in hostname_list])
            where_conditions.append(f"hostname IN ({placeholders})")
            params.extend(hostname_list)
        
        where_clause = " AND ".join(where_conditions)
        
        # Get latest data
        cursor.execute(f"""
            SELECT 
                timestamp, hostname, protocol, drive_model, drive_type,
                block_size, read_write_pattern, queue_depth,
                iops, avg_latency, bandwidth, p95_latency, p99_latency
            FROM test_runs
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ?
        """, params + [limit])
        
        # Flatten metrics into separate TimeSeriesDataPoint objects
        results = []
        metrics_mapping = [
            ("iops", 8, "IOPS"),
            ("avg_latency", 9, "ms"),
            ("bandwidth", 10, "MB/s"),
            ("p95_latency", 11, "ms"),
            ("p99_latency", 12, "ms")
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
                "queue_depth": row[7]
            }
            
            # Create separate time series point for each metric
            for metric_type, col_idx, unit in metrics_mapping:
                if row[col_idx] is not None:
                    results.append({
                        **base_data,
                        "metric_type": metric_type,
                        "value": row[col_idx],
                        "unit": unit
                    })
        
        log_info("Latest time series data retrieved successfully", {
            "request_id": request_id,
            "results_count": len(results)
        })
        
        # Frontend expects direct array, not wrapped object
        return results
    
    except Exception as e:
        log_error("Error retrieving latest time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve latest time series data")


@router.get("/history")
@router.get("/history/")  # Handle with trailing slash
async def get_historical_time_series(
    request: Request,
    hostname: Optional[str] = Query(None, description="Single hostname filter"),
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames"),
    protocol: Optional[str] = Query(None, description="Protocol filter"),
    drive_model: Optional[str] = Query(None, description="Drive model filter"),
    drive_type: Optional[str] = Query(None, description="Drive type filter"),
    block_size: Optional[str] = Query(None, description="Block size filter"),
    read_write_pattern: Optional[str] = Query(None, description="Read/write pattern filter"),
    queue_depth: Optional[int] = Query(None, description="Queue depth filter"),
    metric_type: Optional[str] = Query(None, description="Metric type filter"),
    days: Optional[int] = Query(30, description="Number of days to look back"),
    test_size: Optional[str] = Query(None, description="Test size filter"),
    sync: Optional[int] = Query(None, description="Sync flag filter"),
    direct: Optional[int] = Query(None, description="Direct flag filter"),
    num_jobs: Optional[int] = Query(None, description="Number of jobs filter"),
    duration: Optional[int] = Query(None, description="Duration filter"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    limit: int = Query(10000, ge=1, le=50000, description="Maximum number of results"),
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get historical time series data"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        
        # Build query
        where_conditions = ["1=1"]
        params = []
        
        # Handle both hostname (singular) and hostnames (plural) for compatibility
        if hostname or hostnames:
            hostname_param = hostname if hostname else hostnames
            hostname_list = [h.strip() for h in hostname_param.split(',')]
            placeholders = ','.join(['?' for _ in hostname_list])
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
            from datetime import datetime, timedelta
            end_time = datetime.now()
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
        
        # Get historical data
        cursor.execute(f"""
            SELECT 
                id, timestamp, hostname, protocol, drive_model, drive_type,
                block_size, read_write_pattern, queue_depth,
                iops, avg_latency, bandwidth, p95_latency, p99_latency
            FROM test_runs_all
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ?
        """, params + [limit])
        
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
                "p95_latency": row[12],
                "p99_latency": row[13]
            }
            
            # If metric_type is specified, filter results to only include records with that metric value
            if metric_type:
                metric_value = result.get(metric_type)
                if metric_value is None:
                    continue  # Skip records without the requested metric
            
            results.append(result)
        
        log_info("Historical time series data retrieved successfully", {
            "request_id": request_id,
            "results_count": len(results),
            "date_range": {
                "start": start_date,
                "end": end_date
            }
        })
        
        return results
    
    except Exception as e:
        log_error("Error retrieving historical time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve historical time series data")


@router.get("/trends")
@router.get("/trends/")  # Handle with trailing slash
async def get_trends(
    request: Request,
    hostname: str = Query(..., description="Hostname to analyze"),
    metric: str = Query("iops", description="Metric to analyze"),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    user: User = Depends(require_auth),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get trend analysis for a specific host and metric"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get trend data
        cursor.execute(f"""
            SELECT 
                timestamp, block_size, read_write_pattern, queue_depth, {metric}
            FROM test_runs_all
            WHERE hostname = ? AND timestamp >= ? AND timestamp <= ?
            AND {metric} IS NOT NULL
            ORDER BY timestamp ASC
        """, (hostname, start_date.isoformat(), end_date.isoformat()))
        
        rows = cursor.fetchall()
        
        if not rows:
            return {"data": [], "trend_analysis": {"message": "No data found for the specified period"}}
        
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
                window_values = [rows[j][4] for j in range(i-2, i+1)]
                moving_avg = sum(window_values) / len(window_values)
            
            trends.append(TrendData(
                timestamp=timestamp,
                block_size=block_size,
                read_write_pattern=pattern,
                queue_depth=queue_depth,
                value=value,
                unit=get_metric_unit(metric),
                moving_avg=moving_avg,
                percent_change=percent_change
            ))
            
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
            "overall_change": f"{((values[-1] - values[0]) / values[0]) * 100:.2f}%" if values[0] != 0 else "N/A"
        }
        
        log_info("Trend analysis completed successfully", {
            "request_id": request_id,
            "hostname": hostname,
            "metric": metric,
            "days": days,
            "data_points": len(trends)
        })
        
        return {
            "data": trends,
            "trend_analysis": trend_analysis
        }
    
    except Exception as e:
        log_error("Error retrieving trend analysis", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve trend analysis")


def get_metric_unit(metric: str) -> str:
    """Get unit for metric"""
    units = {
        "iops": "IOPS",
        "avg_latency": "ms",
        "p95_latency": "ms",
        "p99_latency": "ms",
        "bandwidth": "MB/s"
    }
    return units.get(metric, "")