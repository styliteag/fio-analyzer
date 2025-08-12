"""
Helper utilities
"""

import hashlib
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def calculate_unique_key(test_run: Dict[str, Any]) -> str:
    """Calculate unique key for test run"""
    key_parts = [
        str(test_run.get("hostname", "")),
        str(test_run.get("protocol", "")),
        str(test_run.get("drive_type", "")),
        str(test_run.get("drive_model", "")),
        str(test_run.get("block_size", "")),
        str(test_run.get("read_write_pattern", "")),
        str(test_run.get("queue_depth", "")),
        str(test_run.get("num_jobs", "")),
        str(test_run.get("direct", "")),
        str(test_run.get("test_size", "")),
        str(test_run.get("sync", "")),
        str(test_run.get("iodepth", "")),
    ]
    
    key_string = "|".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()[:16]


def get_base_iops(drive_type: str, pattern: str, block_size: str) -> float:
    """Get base IOPS for drive type and pattern"""
    base_iops = {
        "NVMe SSD": 100000,
        "SATA SSD": 50000,
        "HDD": 200,
        "Optane": 500000,
    }
    
    base = base_iops.get(drive_type, 10000)
    
    # Adjust for pattern
    if "random" in pattern:
        base *= 0.7
    if "write" in pattern:
        base *= 0.8
    
    # Adjust for block size
    if block_size in ["1K", "4K"]:
        base *= 1.0
    elif block_size in ["64K", "128K"]:
        base *= 0.5
    elif block_size in ["1M", "2M"]:
        base *= 0.2
    
    return base


def get_base_latency(drive_type: str, pattern: str) -> float:
    """Get base latency for drive type and pattern"""
    base_latency = {
        "NVMe SSD": 0.1,
        "SATA SSD": 0.5,
        "HDD": 5.0,
        "Optane": 0.01,
    }
    
    base = base_latency.get(drive_type, 1.0)
    
    # Adjust for pattern
    if "random" in pattern:
        base *= 2.0
    if "write" in pattern:
        base *= 1.2
    
    return base


def get_base_bandwidth(drive_type: str, pattern: str, block_size: str) -> float:
    """Get base bandwidth for drive type and pattern"""
    base_bandwidth = {
        "NVMe SSD": 3000,
        "SATA SSD": 500,
        "HDD": 150,
        "Optane": 2500,
    }
    
    base = base_bandwidth.get(drive_type, 100)
    
    # Adjust for pattern
    if "random" in pattern:
        base *= 0.6
    if "write" in pattern:
        base *= 0.9
    
    # Adjust for block size
    if block_size in ["1K", "4K"]:
        base *= 0.3
    elif block_size in ["64K", "128K"]:
        base *= 0.8
    elif block_size in ["1M", "2M"]:
        base *= 1.0
    
    return base


def show_server_ready(port: int):
    """Show server ready message"""
    logger.info("FIO Analyzer FastAPI Backend is ready", extra={
        "port": port,
        "api_docs": f"http://localhost:{port}/docs",
        "health_check": f"http://localhost:{port}/health"
    })