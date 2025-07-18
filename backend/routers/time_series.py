"""
Time series API router
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from datetime import datetime, timedelta
import sqlite3

from database.connection import get_db
from database.models import ServerInfo, TrendData
from utils.logging import log_info, log_error


router = APIRouter()


@router.get("/servers", response_model=List[ServerInfo])
async def get_servers(
    request: Request,
    db: sqlite3.Connection = Depends(get_db)
):
    """Get list of servers with test data"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    try:
        cursor = db.cursor()
        
        # Get server information from latest tests
        cursor.execute("""
            SELECT 
                hostname,
                protocol,
                drive_model,
                COUNT(*) as test_count,
                MAX(timestamp) as last_test_time,
                MIN(timestamp) as first_test_time
            FROM test_runs
            WHERE hostname IS NOT NULL AND protocol IS NOT NULL
            GROUP BY hostname, protocol, drive_model
            ORDER BY last_test_time DESC
        """)
        
        servers = []
        for row in cursor.fetchall():
            servers.append(ServerInfo(
                hostname=row[0],
                protocol=row[1],
                drive_model=row[2],
                test_count=row[3],
                last_test_time=row[4],
                first_test_time=row[5]
            ))
        
        log_info("Servers retrieved successfully", {
            "request_id": request_id,
            "server_count": len(servers)
        })
        
        return servers
    
    except Exception as e:
        log_error("Error retrieving servers", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve servers")


@router.get("/latest")
async def get_latest_time_series(
    request: Request,
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
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
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "timestamp": row[0],
                "hostname": row[1],
                "protocol": row[2],
                "drive_model": row[3],
                "drive_type": row[4],
                "block_size": row[5],
                "read_write_pattern": row[6],
                "queue_depth": row[7],
                "metrics": {
                    "iops": row[8],
                    "avg_latency": row[9],
                    "bandwidth": row[10],
                    "p95_latency": row[11],
                    "p99_latency": row[12]
                }
            })
        
        log_info("Latest time series data retrieved successfully", {
            "request_id": request_id,
            "results_count": len(results)
        })
        
        return {"data": results}
    
    except Exception as e:
        log_error("Error retrieving latest time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve latest time series data")


@router.get("/history")
async def get_historical_time_series(
    request: Request,
    hostnames: Optional[str] = Query(None, description="Comma-separated hostnames"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of results"),
    db: sqlite3.Connection = Depends(get_db)
):
    """Get historical time series data"""
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
                timestamp, hostname, protocol, drive_model, drive_type,
                block_size, read_write_pattern, queue_depth,
                iops, avg_latency, bandwidth, p95_latency, p99_latency
            FROM test_runs_all
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ?
        """, params + [limit])
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "timestamp": row[0],
                "hostname": row[1],
                "protocol": row[2],
                "drive_model": row[3],
                "drive_type": row[4],
                "block_size": row[5],
                "read_write_pattern": row[6],
                "queue_depth": row[7],
                "metrics": {
                    "iops": row[8],
                    "avg_latency": row[9],
                    "bandwidth": row[10],
                    "p95_latency": row[11],
                    "p99_latency": row[12]
                }
            })
        
        log_info("Historical time series data retrieved successfully", {
            "request_id": request_id,
            "results_count": len(results),
            "date_range": {
                "start": start_date,
                "end": end_date
            }
        })
        
        return {"data": results}
    
    except Exception as e:
        log_error("Error retrieving historical time series data", e, {"request_id": request_id})
        raise HTTPException(status_code=500, detail="Failed to retrieve historical time series data")


@router.get("/trends")
async def get_trends(
    request: Request,
    hostname: str = Query(..., description="Hostname to analyze"),
    metric: str = Query("iops", description="Metric to analyze"),
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
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