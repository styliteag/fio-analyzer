"""
Pydantic schemas for request/response models

These schemas replace long parameter lists in router endpoints and
provide better validation, documentation, and type safety.
"""

from typing import List, Optional

from pydantic import BaseModel, Field, validator


class TestRunFilters(BaseModel):
    """Request model for test run filtering"""

    hostnames: Optional[str] = Field(None, description="Comma-separated hostnames to filter")
    drive_types: Optional[str] = Field(None, description="Comma-separated drive types to filter")
    drive_models: Optional[str] = Field(None, description="Comma-separated drive models to filter")
    protocols: Optional[str] = Field(None, description="Comma-separated protocols to filter")
    patterns: Optional[str] = Field(None, description="Comma-separated patterns to filter")
    block_sizes: Optional[str] = Field(None, description="Comma-separated block sizes to filter")
    syncs: Optional[str] = Field(None, description="Comma-separated sync values to filter")
    queue_depths: Optional[str] = Field(None, description="Comma-separated queue depths to filter")
    directs: Optional[str] = Field(None, description="Comma-separated direct values to filter")
    num_jobs: Optional[str] = Field(None, description="Comma-separated num_jobs values to filter")

    # Pagination
    limit: Optional[int] = Field(None, ge=1, le=1000, description="Maximum number of results to return")
    offset: Optional[int] = Field(None, ge=0, description="Number of results to skip")

    # Sorting
    order_by: Optional[str] = Field("timestamp", description="Column to sort by")
    order_direction: Optional[str] = Field("DESC", description="Sort direction (ASC or DESC)")

    @validator("order_direction")
    def validate_order_direction(cls, v):
        if v.upper() not in ["ASC", "DESC"]:
            raise ValueError("order_direction must be ASC or DESC")
        return v.upper()

    def to_filter_lists(self) -> dict:
        """Convert comma-separated strings to lists"""
        return {
            "hostnames": self.hostnames.split(",") if self.hostnames else None,
            "drive_types": self.drive_types.split(",") if self.drive_types else None,
            "drive_models": self.drive_models.split(",") if self.drive_models else None,
            "protocols": self.protocols.split(",") if self.protocols else None,
            "patterns": self.patterns.split(",") if self.patterns else None,
            "block_sizes": self.block_sizes.split(",") if self.block_sizes else None,
            "syncs": self.syncs.split(",") if self.syncs else None,
            "queue_depths": self.queue_depths.split(",") if self.queue_depths else None,
            "directs": self.directs.split(",") if self.directs else None,
            "num_jobs": self.num_jobs.split(",") if self.num_jobs else None,
            "limit": self.limit,
            "offset": self.offset,
            "order_by": self.order_by,
            "order_direction": self.order_direction,
        }


class TestRunResponse(BaseModel):
    """Response model for test run data"""

    id: str
    hostname: Optional[str] = None
    drive_type: Optional[str] = None
    drive_model: str
    protocol: Optional[str] = None
    read_write_pattern: str
    block_size: int
    queue_depth: Optional[int] = None
    sync: Optional[int] = None
    direct: Optional[int] = None
    num_jobs: Optional[int] = None
    timestamp: str
    test_name: str

    # Performance metrics
    iops: Optional[float] = None
    avg_latency: Optional[float] = None
    bandwidth: Optional[float] = None
    p95_latency: Optional[float] = None
    p99_latency: Optional[float] = None

    class Config:
        from_attributes = True


class TestRunListResponse(BaseModel):
    """Response model for paginated test run lists"""

    data: List[TestRunResponse]
    total: int
    limit: Optional[int] = None
    offset: Optional[int] = None
    has_more: bool = False


class FilterOptionsResponse(BaseModel):
    """Response model for filter options"""

    hostnames: List[str]
    drive_types: List[str]
    drive_models: List[str]
    protocols: List[str]
    patterns: List[str]
    block_sizes: List[str]
    syncs: List[str]
    queue_depths: List[str]
    directs: List[str]
    num_jobs: List[str]


class TimeSeriesFilters(BaseModel):
    """Request model for time series filtering"""

    hostname: Optional[str] = Field(None, description="Hostname to filter by")
    drive_model: Optional[str] = Field(None, description="Drive model to filter by")
    metric: str = Field("iops", description="Metric to return (iops, latency, bandwidth)")
    days: Optional[int] = Field(30, ge=1, le=365, description="Number of days of data to return")

    @validator("metric")
    def validate_metric(cls, v):
        valid_metrics = ["iops", "latency", "bandwidth", "p95_latency", "p99_latency"]
        if v not in valid_metrics:
            raise ValueError(f'metric must be one of: {", ".join(valid_metrics)}')
        return v


class TimeSeriesDataPoint(BaseModel):
    """Single time series data point"""

    timestamp: str
    value: float
    hostname: Optional[str] = None
    drive_model: Optional[str] = None


class TimeSeriesResponse(BaseModel):
    """Response model for time series data"""

    metric: str
    data: List[TimeSeriesDataPoint]
    hostname: Optional[str] = None
    drive_model: Optional[str] = None


class ImportRequest(BaseModel):
    """Request model for data import"""

    data: dict = Field(..., description="FIO test result data to import")
    hostname: Optional[str] = Field(None, description="Override hostname from data")

    @validator("data")
    def validate_data(cls, v):
        if not isinstance(v, dict):
            raise ValueError("data must be a dictionary")
        return v


class ImportResponse(BaseModel):
    """Response model for import operations"""

    success: bool
    message: str
    test_run_id: Optional[str] = None
    imported_count: Optional[int] = None


class HealthResponse(BaseModel):
    """Response model for health check"""

    status: str
    timestamp: str
    version: str


class ErrorResponse(BaseModel):
    """Standard error response model"""

    error: str
    request_id: Optional[str] = None
