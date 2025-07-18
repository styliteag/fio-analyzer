"""
Database models using Pydantic
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class TestRunBase(BaseModel):
    """Base test run model"""
    timestamp: str = Field(..., description="Test execution timestamp")
    test_date: Optional[str] = Field(None, description="Test date from user input")
    drive_model: str = Field(..., description="Drive model name")
    drive_type: str = Field(..., description="Drive type (NVMe SSD, SATA SSD, HDD)")
    test_name: str = Field(..., description="Test name or identifier")
    block_size: str = Field(..., description="Block size (e.g., 4K, 64K, 1M)")
    read_write_pattern: str = Field(..., description="I/O pattern (read, write, randread, randwrite)")
    queue_depth: int = Field(..., description="I/O queue depth")
    duration: int = Field(..., description="Test duration in seconds")
    fio_version: Optional[str] = Field(None, description="FIO version")
    job_runtime: Optional[int] = Field(None, description="Job runtime in milliseconds")
    rwmixread: Optional[int] = Field(None, description="Read/write mix percentage")
    total_ios_read: Optional[int] = Field(None, description="Total read operations")
    total_ios_write: Optional[int] = Field(None, description="Total write operations")
    usr_cpu: Optional[float] = Field(None, description="User CPU usage percentage")
    sys_cpu: Optional[float] = Field(None, description="System CPU usage percentage")
    hostname: Optional[str] = Field(None, description="Server hostname")
    protocol: Optional[str] = Field(None, description="Storage protocol (Local, iSCSI, NFS, etc.)")
    description: Optional[str] = Field(None, description="Test description")
    uploaded_file_path: Optional[str] = Field(None, description="Uploaded file path")
    
    # Job options
    output_file: Optional[str] = Field(None, description="FIO output filename")
    num_jobs: Optional[int] = Field(None, description="Number of parallel jobs")
    direct: Optional[int] = Field(None, description="Direct I/O flag (0 or 1)")
    test_size: Optional[str] = Field(None, description="Test file size")
    sync: Optional[int] = Field(None, description="Sync flag (0 or 1)")
    iodepth: Optional[int] = Field(None, description="I/O depth")
    
    # Performance metrics
    avg_latency: Optional[float] = Field(None, description="Average latency in ms")
    bandwidth: Optional[float] = Field(None, description="Bandwidth in MB/s")
    iops: Optional[float] = Field(None, description="IOPS")
    p95_latency: Optional[float] = Field(None, description="95th percentile latency in ms")
    p99_latency: Optional[float] = Field(None, description="99th percentile latency in ms")
    
    is_latest: int = Field(default=1, description="Latest test flag (0 or 1)")


class TestRun(TestRunBase):
    """Test run model with ID"""
    id: int = Field(..., description="Test run ID")


class TestRunCreate(TestRunBase):
    """Test run creation model"""
    pass


class TestRunUpdate(BaseModel):
    """Test run update model"""
    description: Optional[str] = None
    test_name: Optional[str] = None
    hostname: Optional[str] = None
    protocol: Optional[str] = None
    drive_type: Optional[str] = None
    drive_model: Optional[str] = None


class BulkUpdateRequest(BaseModel):
    """Bulk update request model"""
    test_run_ids: List[int] = Field(..., description="Array of test run IDs to update")
    updates: TestRunUpdate = Field(..., description="Updates to apply")


class PerformanceMetric(BaseModel):
    """Performance metric model"""
    id: int = Field(..., description="Metric ID")
    test_run_id: int = Field(..., description="Associated test run ID")
    metric_type: str = Field(..., description="Metric type (iops, avg_latency, bandwidth)")
    value: float = Field(..., description="Metric value")
    unit: str = Field(..., description="Measurement unit")
    operation_type: str = Field(..., description="Operation type (read, write, combined)")


class ServerInfo(BaseModel):
    """Server information model"""
    hostname: str = Field(..., description="Server hostname")
    protocol: str = Field(..., description="Storage protocol")
    drive_model: str = Field(..., description="Drive model")
    test_count: int = Field(..., description="Total number of tests")
    last_test_time: str = Field(..., description="Most recent test timestamp")
    first_test_time: str = Field(..., description="First test timestamp")


class TrendData(BaseModel):
    """Trend data model"""
    timestamp: str = Field(..., description="Test timestamp")
    block_size: str = Field(..., description="Block size")
    read_write_pattern: str = Field(..., description="Test pattern")
    queue_depth: int = Field(..., description="Queue depth")
    value: float = Field(..., description="Metric value")
    unit: str = Field(..., description="Unit of measurement")
    moving_avg: Optional[float] = Field(None, description="3-point moving average")
    percent_change: Optional[str] = Field(None, description="Percentage change from previous value")


class FilterOptions(BaseModel):
    """Filter options model"""
    hostnames: List[str] = Field(default=[], description="Available hostnames")
    protocols: List[str] = Field(default=[], description="Available protocols")
    drive_types: List[str] = Field(default=[], description="Available drive types")
    drive_models: List[str] = Field(default=[], description="Available drive models")
    block_sizes: List[str] = Field(default=[], description="Available block sizes")
    patterns: List[str] = Field(default=[], description="Available patterns")


class ImportResponse(BaseModel):
    """Import response model"""
    message: str = Field(..., description="Success message")
    test_run_id: int = Field(..., description="Created test run ID")
    filename: str = Field(..., description="Uploaded filename")


class BulkUpdateResponse(BaseModel):
    """Bulk update response model"""
    message: str = Field(..., description="Success message")
    updated: int = Field(..., description="Number of updated records")
    failed: int = Field(..., description="Number of failed updates")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error message")
    request_id: Optional[str] = Field(None, description="Request ID")