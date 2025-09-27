"""
Pydantic models for API documentation and validation.

These models provide enhanced Swagger documentation and automatic
validation for FastAPI endpoints.
"""

from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class TestRunBase(BaseModel):
    """Base test run model with common fields"""

    timestamp: str = Field(
        ...,
        description="Test execution timestamp in ISO format",
        example="2025-06-31T20:00:00",
    )
    drive_model: str = Field(
        ...,
        description="Storage drive model name",
        example="Samsung SSD 980 PRO",
        max_length=255,
    )
    drive_type: str = Field(
        ..., description="Storage technology type", example="NVMe", max_length=100
    )
    test_name: str = Field(
        ...,
        description="Human-readable test name",
        example="random_read_4k",
        max_length=500,
    )
    block_size: str = Field(
        ..., description="I/O block size", example="4K", max_length=20
    )
    read_write_pattern: str = Field(
        ..., description="I/O access pattern", example="randread", max_length=50
    )
    queue_depth: int = Field(..., description="I/O queue depth", example=32, ge=1)
    duration: int = Field(
        ..., description="Test duration in seconds", example=300, ge=1
    )
    test_date: Optional[str] = Field(
        None, description="Test date in ISO format", example="2025-06-31T20:00:00"
    )
    fio_version: Optional[str] = Field(
        None, description="FIO version used for testing", example="fio-3.33"
    )
    job_runtime: Optional[int] = Field(
        None, description="Job runtime in milliseconds", example=300000
    )
    rwmixread: Optional[int] = Field(
        None,
        description="Read/write mix percentage for reads",
        example=70,
        ge=0,
        le=100,
    )
    total_ios_read: Optional[int] = Field(
        None, description="Total read I/O operations", example=1500000
    )
    total_ios_write: Optional[int] = Field(
        None, description="Total write I/O operations", example=500000
    )
    usr_cpu: Optional[float] = Field(
        None, description="User CPU utilization percentage", example=15.5, ge=0, le=100
    )
    sys_cpu: Optional[float] = Field(
        None, description="System CPU utilization percentage", example=8.2, ge=0, le=100
    )
    hostname: Optional[str] = Field(
        None, description="Server hostname", example="server-01", max_length=255
    )
    protocol: Optional[str] = Field(
        None, description="Storage access protocol", example="Local", max_length=100
    )
    description: Optional[str] = Field(
        None,
        description="Test description or notes",
        example="4K random read performance baseline test",
        max_length=1000,
    )
    uploaded_file_path: Optional[str] = Field(
        None,
        description="Path to uploaded FIO results file",
        example="/uploads/server-01/Local/2025-06-31/20-00/results.json",
    )

    # Job options
    output_file: Optional[str] = Field(
        None, description="FIO output filename", example="testfile"
    )
    num_jobs: Optional[int] = Field(
        None, description="Number of concurrent jobs", example=4, ge=1
    )
    direct: Optional[int] = Field(
        None,
        description="Direct I/O flag (0=buffered, 1=direct)",
        example=1,
        ge=0,
        le=1,
    )
    test_size: Optional[str] = Field(None, description="Test data size", example="10G")
    sync: Optional[int] = Field(
        None, description="Sync flag (0=async, 1=sync)", example=0, ge=0, le=1
    )
    iodepth: Optional[int] = Field(
        None, description="I/O depth (same as queue_depth)", example=32, ge=1
    )

    # Performance metrics
    avg_latency: Optional[float] = Field(
        None, description="Average latency in milliseconds", example=0.256, ge=0
    )
    bandwidth: Optional[float] = Field(
        None, description="Bandwidth in MB/s", example=488.28, ge=0
    )
    iops: Optional[float] = Field(
        None, description="Input/Output Operations Per Second", example=125000.5, ge=0
    )
    p95_latency: Optional[float] = Field(
        None, description="95th percentile latency in milliseconds", example=0.512, ge=0
    )
    p99_latency: Optional[float] = Field(
        None, description="99th percentile latency in milliseconds", example=1.024, ge=0
    )
    is_latest: int = Field(
        1,
        description="Flag indicating if this is the latest test for this configuration",
        example=1,
        ge=0,
        le=1,
    )


class TestRunResponse(TestRunBase):
    """Test run response model with ID"""

    id: int = Field(..., description="Unique test run identifier", example=1, gt=0)


class TestRunUpdate(BaseModel):
    """Test run update model with optional fields"""

    description: Optional[str] = Field(
        None,
        description="Updated test description",
        example="Updated test description",
        max_length=1000,
    )
    test_name: Optional[str] = Field(
        None,
        description="Updated test name",
        example="Updated test name",
        max_length=500,
    )
    hostname: Optional[str] = Field(
        None, description="Updated hostname", example="new-server-name", max_length=255
    )
    protocol: Optional[str] = Field(
        None, description="Updated protocol", example="iSCSI", max_length=100
    )
    drive_type: Optional[str] = Field(
        None, description="Updated drive type", example="SATA", max_length=100
    )
    drive_model: Optional[str] = Field(
        None,
        description="Updated drive model",
        example="WD Black SN850",
        max_length=255,
    )


class BulkUpdateRequest(BaseModel):
    """Bulk update request model"""

    test_run_ids: List[int] = Field(
        ...,
        description="List of test run IDs to update",
        example=[1, 2, 3, 15, 42],
        min_items=1,
    )
    updates: TestRunUpdate = Field(..., description="Fields to update with new values")


class PerformanceMetric(BaseModel):
    """Performance metric with value and unit"""

    value: Optional[float] = Field(None, description="Metric value", example=125000.5)
    unit: str = Field(..., description="Metric unit", example="IOPS")


class PerformanceMetrics(BaseModel):
    """Collection of performance metrics"""

    iops: Optional[PerformanceMetric] = Field(
        None, description="Input/Output Operations Per Second"
    )
    avg_latency: Optional[PerformanceMetric] = Field(
        None, description="Average response time"
    )
    bandwidth: Optional[PerformanceMetric] = Field(
        None, description="Data transfer rate"
    )
    p95_latency: Optional[PerformanceMetric] = Field(
        None, description="95th percentile latency"
    )
    p99_latency: Optional[PerformanceMetric] = Field(
        None, description="99th percentile latency"
    )


class PerformanceDataResponse(BaseModel):
    """Performance data response with structured metrics"""

    id: int = Field(..., description="Test run ID", example=1)
    drive_model: str = Field(
        ..., description="Drive model", example="Samsung SSD 980 PRO"
    )
    drive_type: str = Field(..., description="Drive type", example="NVMe")
    test_name: str = Field(..., description="Test name", example="random_read_4k")
    description: Optional[str] = Field(None, description="Test description")
    block_size: str = Field(..., description="Block size", example="4K")
    read_write_pattern: str = Field(..., description="I/O pattern", example="randread")
    timestamp: str = Field(
        ..., description="Test timestamp", example="2025-06-31T20:00:00"
    )
    queue_depth: int = Field(..., description="Queue depth", example=32)
    hostname: str = Field(..., description="Hostname", example="server-01")
    protocol: str = Field(..., description="Protocol", example="Local")
    output_file: Optional[str] = Field(None, description="Output file")
    num_jobs: Optional[int] = Field(None, description="Number of jobs")
    direct: Optional[int] = Field(None, description="Direct I/O flag")
    test_size: Optional[str] = Field(None, description="Test size")
    sync: Optional[int] = Field(None, description="Sync flag")
    iodepth: Optional[int] = Field(None, description="I/O depth")
    duration: int = Field(..., description="Duration in seconds", example=300)
    metrics: PerformanceMetrics = Field(..., description="Performance metrics")


class ServerInfo(BaseModel):
    """Server information with test statistics"""

    hostname: str = Field(..., description="Server hostname", example="server-01")
    config_count: int = Field(
        ..., description="Number of unique test configurations", example=15, ge=0
    )
    total_runs: int = Field(
        ..., description="Total number of test executions", example=342, ge=0
    )
    last_test_time: str = Field(
        ..., description="Most recent test timestamp", example="2025-06-31T20:00:00"
    )
    first_test_time: str = Field(
        ..., description="Oldest test timestamp", example="2024-01-15T10:30:00"
    )


class TrendDataPoint(BaseModel):
    """Single trend data point"""

    timestamp: str = Field(
        ..., description="Data point timestamp", example="2025-06-31T20:00:00"
    )
    block_size: str = Field(
        ..., description="Block size for this data point", example="4K"
    )
    read_write_pattern: str = Field(
        ..., description="I/O pattern for this data point", example="randread"
    )
    queue_depth: int = Field(
        ..., description="Queue depth for this data point", example=32
    )
    value: float = Field(..., description="Metric value", example=125000.5)
    unit: str = Field(..., description="Metric unit", example="IOPS")
    moving_avg: Optional[float] = Field(
        None, description="3-point moving average", example=123500.0
    )
    percent_change: Optional[str] = Field(
        None, description="Percentage change from previous value", example="+2.5%"
    )


class TrendAnalysis(BaseModel):
    """Statistical trend analysis"""

    total_points: int = Field(
        ..., description="Total number of data points analyzed", example=30, ge=0
    )
    min_value: float = Field(
        ..., description="Minimum value in the dataset", example=115000.0
    )
    max_value: float = Field(
        ..., description="Maximum value in the dataset", example=125000.0
    )
    avg_value: float = Field(
        ..., description="Average value across all data points", example=120500.0
    )
    first_value: float = Field(
        ..., description="First chronological value", example=118000.0
    )
    last_value: float = Field(
        ..., description="Last chronological value", example=122000.0
    )
    overall_change: str = Field(
        ..., description="Overall percentage change from first to last", example="+3.4%"
    )


class TrendResponse(BaseModel):
    """Trend analysis response"""

    data: List[TrendDataPoint] = Field(
        ..., description="Chronological trend data points"
    )
    trend_analysis: TrendAnalysis = Field(
        ..., description="Statistical analysis of the trend"
    )


class TimeSeriesDataPoint(BaseModel):
    """Time series data point for visualization"""

    timestamp: str = Field(
        ..., description="Data timestamp", example="2025-06-31T20:00:00"
    )
    hostname: str = Field(..., description="Server hostname", example="server-01")
    protocol: str = Field(..., description="Storage protocol", example="Local")
    drive_model: str = Field(
        ..., description="Drive model", example="Samsung SSD 980 PRO"
    )
    drive_type: str = Field(..., description="Drive type", example="NVMe")
    block_size: str = Field(..., description="Block size", example="4K")
    read_write_pattern: str = Field(..., description="I/O pattern", example="randread")
    queue_depth: int = Field(..., description="Queue depth", example=32)
    metric_type: str = Field(..., description="Metric type", example="iops")
    value: float = Field(..., description="Metric value", example=125000.5)
    unit: str = Field(..., description="Metric unit", example="IOPS")


class HistoricalDataPoint(BaseModel):
    """Historical time series data point"""

    test_run_id: int = Field(..., description="Test run ID", example=1)
    timestamp: str = Field(
        ..., description="Test timestamp", example="2025-06-31T20:00:00"
    )
    hostname: str = Field(..., description="Server hostname", example="server-01")
    protocol: str = Field(..., description="Storage protocol", example="Local")
    drive_model: str = Field(
        ..., description="Drive model", example="Samsung SSD 980 PRO"
    )
    block_size: str = Field(..., description="Block size", example="4K")
    read_write_pattern: str = Field(..., description="I/O pattern", example="randread")
    queue_depth: int = Field(..., description="Queue depth", example=32)
    iops: Optional[float] = Field(None, description="IOPS value", example=125000.5)
    avg_latency: Optional[float] = Field(
        None, description="Average latency in ms", example=0.256
    )
    bandwidth: Optional[float] = Field(
        None, description="Bandwidth in MB/s", example=488.28
    )
    p95_latency: Optional[float] = Field(
        None, description="P95 latency in ms", example=0.512
    )
    p99_latency: Optional[float] = Field(
        None, description="P99 latency in ms", example=1.024
    )


class FilterOptions(BaseModel):
    """Available filter options"""

    drive_models: List[str] = Field(
        ...,
        description="Available drive models",
        example=["Samsung SSD 980 PRO", "WD Black SN850"],
    )
    host_disk_combinations: List[str] = Field(
        ...,
        description="Formatted hostname-protocol-drive combinations",
        example=["server-01 - Local - Samsung SSD 980 PRO"],
    )
    block_sizes: List[str] = Field(
        ..., description="Available block sizes", example=["4K", "8K", "64K", "1M"]
    )
    patterns: List[str] = Field(
        ...,
        description="Available I/O patterns",
        example=["randread", "randwrite", "read", "write"],
    )
    syncs: List[int] = Field(
        ..., description="Available sync flag values", example=[0, 1]
    )
    queue_depths: List[int] = Field(
        ..., description="Available queue depths", example=[1, 8, 16, 32, 64]
    )
    directs: List[int] = Field(
        ..., description="Available direct I/O flag values", example=[0, 1]
    )
    num_jobs: List[int] = Field(
        ..., description="Available job count values", example=[1, 4, 8, 16]
    )
    test_sizes: List[str] = Field(
        ..., description="Available test sizes", example=["1G", "10G", "100G"]
    )
    durations: List[int] = Field(
        ...,
        description="Available test durations in seconds",
        example=[30, 60, 300, 600],
    )
    hostnames: List[str] = Field(
        ...,
        description="Available hostnames",
        example=["server-01", "server-02", "server-03"],
    )
    protocols: List[str] = Field(
        ..., description="Available protocols", example=["Local", "iSCSI", "NFS"]
    )
    drive_types: List[str] = Field(
        ..., description="Available drive types", example=["NVMe", "SATA", "SAS"]
    )


class ImportResponse(BaseModel):
    """Import operation response"""

    message: str = Field(
        ...,
        description="Import operation result message",
        example="FIO data imported successfully",
    )
    test_run_id: int = Field(
        ..., description="ID of the newly created test run", example=42
    )
    filename: str = Field(
        ...,
        description="Name of the imported file",
        example="fio_results_2025-06-31.json",
    )


class BulkImportStatistics(BaseModel):
    """Bulk import operation statistics"""

    totalFiles: int = Field(
        ..., description="Total number of files found", example=30, ge=0
    )
    processedFiles: int = Field(
        ..., description="Number of files successfully processed", example=25, ge=0
    )
    totalTestRuns: int = Field(
        ..., description="Number of test runs imported", example=25, ge=0
    )
    skippedFiles: int = Field(
        ..., description="Number of files skipped (duplicates)", example=3, ge=0
    )
    errorFiles: int = Field(
        ..., description="Number of files with errors", example=2, ge=0
    )


class BulkImportDryRunResult(BaseModel):
    """Dry run result for a single file"""

    path: str = Field(
        ...,
        description="File path",
        example="/uploads/server-01/Local/2025-06-31/20-00/test.json",
    )
    metadata: Dict[str, Any] = Field(
        ...,
        description="Extracted metadata",
        example={
            "hostname": "server-01",
            "protocol": "Local",
            "test_name": "randread_4k",
        },
    )


class BulkImportResponse(BaseModel):
    """Bulk import operation response"""

    message: str = Field(
        ...,
        description="Bulk import result message",
        example="Bulk import completed: 25 files processed, 25 test runs imported",
    )
    statistics: BulkImportStatistics = Field(
        ..., description="Import operation statistics"
    )
    dryRunResults: Optional[List[BulkImportDryRunResult]] = Field(
        None, description="Dry run results (only present when dryRun=true)"
    )


class BulkUpdateResponse(BaseModel):
    """Bulk update operation response"""

    message: str = Field(
        ...,
        description="Update operation result message",
        example="Successfully updated 5 test runs",
    )
    updated: int = Field(
        ..., description="Number of successfully updated records", example=5, ge=0
    )
    failed: int = Field(
        ..., description="Number of records that failed to update", example=0, ge=0
    )


class BulkDeleteResponse(BaseModel):
    """Bulk delete operation response"""

    deleted: int = Field(
        ..., description="Number of successfully deleted records", example=8, ge=0
    )
    notFound: int = Field(
        ..., description="Number of records that were not found", example=2, ge=0
    )


class APIInfo(BaseModel):
    """API information response"""

    name: str = Field(..., description="API name", example="FIO Analyzer API")
    version: str = Field(..., description="API version", example="1.0.0")
    description: str = Field(
        ...,
        description="API description",
        example="API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring",
    )
    endpoints: int = Field(
        ..., description="Number of available endpoints", example=20, ge=0
    )
    documentation: str = Field(
        ..., description="Primary documentation URL", example="/docs"
    )
    redoc_documentation: str = Field(
        ..., description="ReDoc documentation URL", example="/redoc"
    )
    openapi_schema: str = Field(
        ..., description="OpenAPI schema URL", example="/openapi.json"
    )
    features: List[str] = Field(
        ...,
        description="List of API features",
        example=[
            "FIO benchmark data import",
            "Performance metrics analysis",
            "Historical time series data",
        ],
    )
    supported_formats: List[str] = Field(
        ..., description="Supported data formats", example=["JSON"]
    )
    authentication: str = Field(
        ..., description="Authentication method", example="HTTP Basic Auth"
    )


class SuccessResponse(BaseModel):
    """Generic success response"""

    message: str = Field(
        ..., description="Success message", example="Operation completed successfully"
    )


class ErrorResponse(BaseModel):
    """Error response model"""

    error: str = Field(
        ..., description="Error message", example="Invalid request parameters"
    )
    request_id: Optional[str] = Field(
        None,
        description="Request ID for tracking",
        example="550e8400-e29b-41d4-a716-446655440000",
    )


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(..., description="Service status", example="OK")
    timestamp: str = Field(
        ..., description="Health check timestamp", example="2025-06-31T20:00:00Z"
    )
    version: str = Field(..., description="API version", example="1.0.0")
