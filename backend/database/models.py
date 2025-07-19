"""Database models using Python dataclasses"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, TypedDict


@dataclass
class TestRunBase:
    """Base test run model"""
    timestamp: str
    drive_model: str
    drive_type: str
    test_name: str
    block_size: str
    read_write_pattern: str
    queue_depth: int
    duration: int
    test_date: Optional[str] = None
    fio_version: Optional[str] = None
    job_runtime: Optional[int] = None
    rwmixread: Optional[int] = None
    total_ios_read: Optional[int] = None
    total_ios_write: Optional[int] = None
    usr_cpu: Optional[float] = None
    sys_cpu: Optional[float] = None
    hostname: Optional[str] = None
    protocol: Optional[str] = None
    description: Optional[str] = None
    uploaded_file_path: Optional[str] = None
    # Job options
    output_file: Optional[str] = None
    num_jobs: Optional[int] = None
    direct: Optional[int] = None
    test_size: Optional[str] = None
    sync: Optional[int] = None
    iodepth: Optional[int] = None
    # Performance metrics
    avg_latency: Optional[float] = None
    bandwidth: Optional[float] = None
    iops: Optional[float] = None
    p95_latency: Optional[float] = None
    p99_latency: Optional[float] = None
    is_latest: int = 1


@dataclass
class TestRun(TestRunBase):
    """Test run model with ID"""
    id: int = 0


@dataclass
class TestRunUpdate:
    """Test run update model"""
    description: Optional[str] = None
    test_name: Optional[str] = None
    hostname: Optional[str] = None
    protocol: Optional[str] = None
    drive_type: Optional[str] = None
    drive_model: Optional[str] = None


@dataclass 
class BulkUpdateRequest:
    """Bulk update request model"""
    test_run_ids: List[int]
    updates: TestRunUpdate


@dataclass
class PerformanceMetric:
    """Performance metric model"""
    id: int
    test_run_id: int
    metric_type: str
    value: float
    unit: str
    operation_type: str


@dataclass
class ServerInfo:
    """Server information model"""
    hostname: str
    protocol: str
    drive_model: str
    test_count: int
    last_test_time: str
    first_test_time: str


@dataclass
class TrendData:
    """Trend data model"""
    timestamp: str
    block_size: str
    read_write_pattern: str
    queue_depth: int
    value: float
    unit: str
    moving_avg: Optional[float] = None
    percent_change: Optional[str] = None


# Simple TypedDict classes for API responses
class FilterOptions(TypedDict):
    """Filter options response"""
    hostnames: List[str]
    protocols: List[str]
    drive_types: List[str]
    drive_models: List[str]
    block_sizes: List[str]
    patterns: List[str]


class ImportResponse(TypedDict):
    """Import response"""
    message: str
    test_run_id: int
    filename: str


class BulkUpdateResponse(TypedDict):
    """Bulk update response"""
    message: str
    updated: int
    failed: int


class ErrorResponse(TypedDict):
    """Error response"""
    error: str
    request_id: Optional[str]


# Helper functions for dataclass conversion
def dataclass_to_dict(obj) -> Dict[str, Any]:
    """Convert dataclass to dictionary"""
    if hasattr(obj, '__dataclass_fields__'):
        from dataclasses import asdict
        return asdict(obj)
    return obj


def dict_to_test_run(data: Dict[str, Any]) -> TestRun:
    """Convert dictionary to TestRun dataclass"""
    # Filter out None values and unknown fields
    known_fields = {f.name for f in TestRun.__dataclass_fields__.values()}
    filtered_data = {k: v for k, v in data.items() if k in known_fields and v is not None}
    return TestRun(**filtered_data)