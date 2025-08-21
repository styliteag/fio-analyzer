"""
FIO Analyzer FastAPI Backend

A comprehensive API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring.
"""

import os
import signal
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn

from config.settings import settings
from database.connection import init_database, close_database
from utils.logging import setup_logging, log_info, log_error
from routers import test_runs, imports, time_series, utils_router, users
from auth.middleware import require_auth, User


# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    log_info("Starting FIO Analyzer FastAPI Backend", {
        "version": "1.0.0",
        "python_version": os.sys.version,
        "platform": os.sys.platform,
        "process_id": os.getpid()
    })
    
    # Initialize database
    await init_database()
    
    yield
    
    # Shutdown
    log_info("Shutting down FIO Analyzer FastAPI Backend", {
        "process_id": os.getpid()
    })
    await close_database()


# Create FastAPI app with comprehensive metadata
app = FastAPI(
    title="FIO Analyzer API",
    description="""
## FIO Performance Analysis and Monitoring API

A comprehensive REST API for analyzing FIO (Flexible I/O Tester) benchmark results 
and monitoring storage performance over time.

### Key Features

* **Data Import**: Upload and parse FIO JSON benchmark results
* **Performance Analytics**: Analyze IOPS, latency, bandwidth metrics
* **Time Series Data**: Historical performance tracking and trend analysis
* **User Management**: Role-based access control (admin/uploader)
* **Bulk Operations**: Efficient batch import and update capabilities
* **Real-time Monitoring**: Latest performance data access

### Authentication

The API uses HTTP Basic Authentication with two user roles:
- **Admin**: Full access to all endpoints and user management
- **Uploader**: Can upload test data and view results

### Data Sources

- **Latest Data**: Most recent test results per configuration
- **Historical Data**: Complete time series of all test runs
- **Performance Metrics**: IOPS, latency (avg/P95/P99), bandwidth

### Getting Started

1. Import FIO test data via `/api/import`
2. View available filters at `/api/filters` 
3. Query test results at `/api/test-runs`
4. Analyze trends at `/api/time-series/trends`

For detailed examples and testing, visit the interactive documentation below.
    """,
    version="1.0.0",
    contact={
        "name": "FIO Analyzer Project",
        "url": "https://github.com/fio-analyzer",
        "email": "admin@fio-analyzer.local"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    terms_of_service="https://github.com/fio-analyzer/terms",
    servers=[
        {
            "url": "http://localhost:8000",
            "description": "Development server"
        },
        {
            "url": "http://example.intern",
            "description": "Production server"
        }
    ],
    tags_metadata=[
        {
            "name": "Health",
            "description": "API health check and status monitoring"
        },
        {
            "name": "Data Import", 
            "description": "Import FIO benchmark data from JSON files"
        },
        {
            "name": "Test Runs",
            "description": "Manage and query individual test run data"
        },
        {
            "name": "Time Series Analytics",
            "description": "Historical data analysis and trend monitoring"
        },
        {
            "name": "Utilities & Filters",
            "description": "Helper endpoints for filters and API information"
        },
        {
            "name": "User Management",
            "description": "User account and authentication management (admin only)"
        }
    ],
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    import time
    import uuid
    
    # Generate request ID
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    start_time = time.time()
    
    log_info("Request started", {
        "request_id": request_id,
        "method": request.method,
        "url": str(request.url),
        "client_ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown")
    })
    
    try:
        response = await call_next(request)
        
        process_time = time.time() - start_time
        log_info("Request completed", {
            "request_id": request_id,
            "status_code": response.status_code,
            "process_time": f"{process_time:.4f}s"
        })
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
    
    except Exception as e:
        process_time = time.time() - start_time
        log_error("Request failed", e, {
            "request_id": request_id,
            "process_time": f"{process_time:.4f}s"
        })
        raise


# Include routers with descriptive tags
app.include_router(
    test_runs.router, 
    prefix="/api/test-runs", 
    tags=["Test Runs"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)
app.include_router(
    imports.router, 
    prefix="/api/import", 
    tags=["Data Import"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Upload permission required"},
        500: {"description": "Internal server error"}
    }
)
app.include_router(
    time_series.router, 
    prefix="/api/time-series", 
    tags=["Time Series Analytics"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)
app.include_router(
    utils_router.router, 
    prefix="/api", 
    tags=["Utilities & Filters"],
    responses={
        401: {"description": "Authentication required"},
        500: {"description": "Internal server error"}
    }
)
app.include_router(
    users.router, 
    tags=["User Management"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Admin access required"},
        500: {"description": "Internal server error"}
    }
)


# Health check endpoint
@app.get(
    "/health", 
    tags=["Health"],
    summary="Health Check",
    description="Check API service health and status",
    response_model=None,  # We'll import the model later
    responses={
        200: {
            "description": "Service is healthy and operational",
            "content": {
                "application/json": {
                    "example": {
                        "status": "OK",
                        "timestamp": "2025-06-31T20:00:00Z",
                        "version": "1.0.0"
                    }
                }
            }
        }
    }
)
async def health_check():
    """
    Check the health and operational status of the FIO Analyzer API.
    
    This endpoint provides a simple health check to verify that the API
    is running and accessible. It returns basic status information including
    the current timestamp and API version.
    
    **No Authentication Required**
    
    **Use Cases:**
    - Load balancer health checks
    - Monitoring system integration
    - Service availability verification
    - API status validation
    """
    return {
        "status": "OK",
        "timestamp": "2025-06-31T20:00:00Z",
        "version": settings.version
    }


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTPException to use 'error' instead of 'detail' for API compatibility"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    log_info("HTTP exception", {
        "request_id": request_id,
        "status_code": exc.status_code,
        "detail": str(exc.detail),
        "url": str(request.url)
    })
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail)}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle FastAPI validation errors to match old API format"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    # Extract first validation error and create simple error message
    error_detail = exc.errors()[0] if exc.errors() else {}
    field_name = error_detail.get('loc', ['unknown'])[-1]  # Get the last part of the location
    error_type = error_detail.get('type', 'validation_error')
    
    # Create user-friendly error message
    if error_type == 'missing':
        error_message = f"{field_name} is required"
    else:
        error_message = f"Invalid {field_name}"
    
    log_info("Validation error", {
        "request_id": request_id,
        "error": error_message,
        "field": field_name,
        "url": str(request.url)
    })
    
    return JSONResponse(
        status_code=400,
        content={"error": error_message}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    log_error("Unhandled exception", exc, {
        "request_id": request_id,
        "method": request.method,
        "url": str(request.url)
    })
    
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "request_id": request_id}
    )


# Graceful shutdown handlers
def signal_handler(signum, frame):
    """Handle shutdown signals"""
    log_info("Received shutdown signal", {
        "signal": signum,
        "process_id": os.getpid()
    })
    # uvicorn will handle the actual shutdown


if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=False,
        access_log=False  # We handle logging ourselves
    )