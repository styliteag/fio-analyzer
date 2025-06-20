from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sqlite3
import json
from datetime import datetime, timedelta
import random
import uvicorn
from typing import List, Optional
from pydantic import BaseModel

DB_PATH = "db/storage_performance.db"

app = FastAPI(title="Storage Performance API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database models
class TestRun(BaseModel):
    id: int
    timestamp: str
    drive_model: str
    drive_type: str
    test_name: str
    block_size: int
    read_write_pattern: str
    queue_depth: int
    duration: int

class PerformanceMetric(BaseModel):
    test_run_id: int
    metric_type: str
    value: float
    unit: str

# Initialize database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS test_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            drive_model TEXT NOT NULL,
            drive_type TEXT NOT NULL,
            test_name TEXT NOT NULL,
            block_size INTEGER NOT NULL,
            read_write_pattern TEXT NOT NULL,
            queue_depth INTEGER NOT NULL,
            duration INTEGER NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS performance_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_run_id INTEGER NOT NULL,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            FOREIGN KEY (test_run_id) REFERENCES test_runs (id)
        )
    ''')
    
    # Check if we need to populate sample data
    cursor.execute('SELECT COUNT(*) FROM test_runs')
    if cursor.fetchone()[0] == 0:
        populate_sample_data(cursor)
    
    conn.commit()
    conn.close()

def populate_sample_data(cursor):
    # Sample drives
    drives = [
        ("Samsung 980 PRO", "NVMe SSD"),
        ("WD Black SN850", "NVMe SSD"),
        ("Crucial MX500", "SATA SSD"),
        ("Seagate Barracuda", "HDD"),
        ("Intel Optane", "NVMe SSD")
    ]
    
    # Test configurations
    block_sizes = [4, 8, 16, 32, 64, 128]  # KB
    patterns = ["sequential_read", "sequential_write", "random_read", "random_write", "mixed_70_30"]
    queue_depths = [1, 4, 8, 16, 32]
    
    test_run_id = 1
    
    for drive_model, drive_type in drives:
        for _ in range(10):  # 10 test runs per drive
            timestamp = datetime.now() - timedelta(days=random.randint(1, 30))
            
            for block_size in random.sample(block_sizes, 3):
                for pattern in random.sample(patterns, 2):
                    queue_depth = random.choice(queue_depths)
                    
                    # Insert test run
                    cursor.execute('''
                        INSERT INTO test_runs 
                        (timestamp, drive_model, drive_type, test_name, block_size, 
                         read_write_pattern, queue_depth, duration)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        timestamp.isoformat(),
                        drive_model,
                        drive_type,
                        f"FIO_{pattern}_{block_size}k",
                        block_size,
                        pattern,
                        queue_depth,
                        300  # 5 minutes
                    ))
                    
                    # Generate realistic performance metrics based on drive type and test
                    base_iops = get_base_iops(drive_type, pattern, block_size)
                    base_latency = get_base_latency(drive_type, pattern)
                    base_throughput = get_base_throughput(drive_type, pattern, block_size)
                    
                    # Add some variance
                    iops = base_iops * random.uniform(0.8, 1.2)
                    latency = base_latency * random.uniform(0.7, 1.3)
                    throughput = base_throughput * random.uniform(0.85, 1.15)
                    
                    # Insert metrics
                    metrics = [
                        (test_run_id, "iops", iops, "IOPS"),
                        (test_run_id, "avg_latency", latency, "ms"),
                        (test_run_id, "throughput", throughput, "MB/s"),
                        (test_run_id, "p95_latency", latency * 1.5, "ms"),
                        (test_run_id, "p99_latency", latency * 2.2, "ms")
                    ]
                    
                    for metric in metrics:
                        cursor.execute('''
                            INSERT INTO performance_metrics 
                            (test_run_id, metric_type, value, unit)
                            VALUES (?, ?, ?, ?)
                        ''', metric)
                    
                    test_run_id += 1

def get_base_iops(drive_type, pattern, block_size):
    base_values = {
        "NVMe SSD": {"sequential": 100000, "random": 50000},
        "SATA SSD": {"sequential": 50000, "random": 25000},
        "HDD": {"sequential": 200, "random": 100}
    }
    
    pattern_type = "sequential" if "sequential" in pattern else "random"
    base = base_values[drive_type][pattern_type]
    
    # Adjust for block size (smaller blocks = higher IOPS)
    return base * (64 / block_size) ** 0.5

def get_base_latency(drive_type, pattern):
    base_values = {
        "NVMe SSD": {"sequential": 0.1, "random": 0.2},
        "SATA SSD": {"sequential": 0.5, "random": 1.0},
        "HDD": {"sequential": 8.0, "random": 12.0}
    }
    
    pattern_type = "sequential" if "sequential" in pattern else "random"
    return base_values[drive_type][pattern_type]

def get_base_throughput(drive_type, pattern, block_size):
    base_values = {
        "NVMe SSD": {"sequential": 3500, "random": 2000},
        "SATA SSD": {"sequential": 550, "random": 400},
        "HDD": {"sequential": 150, "random": 80}
    }
    
    pattern_type = "sequential" if "sequential" in pattern else "random"
    base = base_values[drive_type][pattern_type]
    
    # Adjust for block size (larger blocks = higher throughput)
    return base * (block_size / 64) ** 0.3

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/api/test-runs")
async def get_test_runs():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, timestamp, drive_model, drive_type, test_name, 
               block_size, read_write_pattern, queue_depth, duration
        FROM test_runs
        ORDER BY timestamp DESC
    ''')
    
    runs = []
    for row in cursor.fetchall():
        runs.append({
            "id": row[0],
            "timestamp": row[1],
            "drive_model": row[2],
            "drive_type": row[3],
            "test_name": row[4],
            "block_size": row[5],
            "read_write_pattern": row[6],
            "queue_depth": row[7],
            "duration": row[8]
        })
    
    conn.close()
    return runs

@app.get("/api/performance-data")
async def get_performance_data(test_run_ids: str, metric_types: str = "iops,avg_latency,throughput"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    run_ids = [int(id.strip()) for id in test_run_ids.split(',')]
    metrics = [m.strip() for m in metric_types.split(',')]
    
    placeholders = ','.join(['?' for _ in run_ids])
    metric_placeholders = ','.join(['?' for _ in metrics])
    
    query = f'''
        SELECT tr.id, tr.drive_model, tr.drive_type, tr.test_name, 
               tr.block_size, tr.read_write_pattern, tr.timestamp,
               pm.metric_type, pm.value, pm.unit
        FROM test_runs tr
        JOIN performance_metrics pm ON tr.id = pm.test_run_id
        WHERE tr.id IN ({placeholders}) AND pm.metric_type IN ({metric_placeholders})
        ORDER BY tr.timestamp, pm.metric_type
    '''
    
    cursor.execute(query, run_ids + metrics)
    
    data = {}
    for row in cursor.fetchall():
        run_id = row[0]
        if run_id not in data:
            data[run_id] = {
                "id": run_id,
                "drive_model": row[1],
                "drive_type": row[2],
                "test_name": row[3],
                "block_size": row[4],
                "read_write_pattern": row[5],
                "timestamp": row[6],
                "metrics": {}
            }
        
        data[run_id]["metrics"][row[7]] = {
            "value": row[8],
            "unit": row[9]
        }
    
    conn.close()
    return list(data.values())

@app.get("/api/filters")
async def get_filters():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get unique drive types
    cursor.execute('SELECT DISTINCT drive_type FROM test_runs ORDER BY drive_type')
    drive_types = [row[0] for row in cursor.fetchall()]
    
    # Get unique drive models
    cursor.execute('SELECT DISTINCT drive_model FROM test_runs ORDER BY drive_model')
    drive_models = [row[0] for row in cursor.fetchall()]
    
    # Get unique patterns
    cursor.execute('SELECT DISTINCT read_write_pattern FROM test_runs ORDER BY read_write_pattern')
    patterns = [row[0] for row in cursor.fetchall()]
    
    # Get block sizes
    cursor.execute('SELECT DISTINCT block_size FROM test_runs ORDER BY block_size')
    block_sizes = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    return {
        "drive_types": drive_types,
        "drive_models": drive_models,
        "patterns": patterns,
        "block_sizes": block_sizes
    }


@app.post("/api/import")
async def import_fio_results(
    file: UploadFile = File(...),
    drive_model: str = "Unknown",
    drive_type: str = "Unknown",
):
    try:
        contents = await file.read()
        fio_data = json.loads(contents)

        # Assume first job contains the relevant metrics
        job = fio_data.get("jobs", [{}])[0]
        opts = job.get("job options", {})
        global_opts = fio_data.get("global options", {})

        bs = opts.get("bs") or global_opts.get("bs", "4k")
        block_size = int(str(bs).rstrip("k"))

        rw = opts.get("rw") or global_opts.get("rw", "read")

        iodepth = opts.get("iodepth") or global_opts.get("iodepth", 1)
        queue_depth = int(iodepth)

        duration = job.get("runtime", 0)
        test_name = job.get("jobname", "fio_test")

        read_metrics = job.get("read", {})
        write_metrics = job.get("write", {})
        metrics_source = read_metrics if read_metrics else write_metrics

        iops = metrics_source.get("iops", 0)
        bw_kib = metrics_source.get("bw", 0)
        throughput = bw_kib / 1024  # Convert to MB/s

        clat = metrics_source.get("clat_ns", {}) or metrics_source.get("clat_us", {})
        latency = clat.get("mean", 0)
        if "clat_us" in metrics_source:
            latency = latency / 1000.0
        else:
            latency = latency / 1_000_000.0

        percentiles = clat.get("percentile", {})
        p95 = percentiles.get("95.000000", 0)
        p99 = percentiles.get("99.000000", 0)
        if "clat_us" in metrics_source:
            p95 /= 1000.0
            p99 /= 1000.0
        else:
            p95 /= 1_000_000.0
            p99 /= 1_000_000.0

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO test_runs
            (timestamp, drive_model, drive_type, test_name, block_size,
             read_write_pattern, queue_depth, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                datetime.now().isoformat(),
                drive_model,
                drive_type,
                test_name,
                block_size,
                rw,
                queue_depth,
                duration,
            ),
        )
        test_run_id = cursor.lastrowid

        metrics = [
            (test_run_id, "iops", iops, "IOPS"),
            (test_run_id, "avg_latency", latency, "ms"),
            (test_run_id, "throughput", throughput, "MB/s"),
            (test_run_id, "p95_latency", p95, "ms"),
            (test_run_id, "p99_latency", p99, "ms"),
        ]

        for m in metrics:
            cursor.execute(
                """
                INSERT INTO performance_metrics
                (test_run_id, metric_type, value, unit)
                VALUES (?, ?, ?, ?)
            """,
                m,
            )

        conn.commit()
        conn.close()

        return {"message": "FIO results imported", "test_run_id": test_run_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
