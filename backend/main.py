"""
FIO Analyzer FastAPI Backend

A comprehensive API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring.
"""

import os
import signal
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config.settings import settings
from database.connection import init_database, close_database
from utils.logging import setup_logging, log_info, log_error
from routers import test_runs, imports, time_series, utils_router
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


# Create FastAPI app
app = FastAPI(
    title="FIO Analyzer API",
    description="A comprehensive API for FIO (Flexible I/O Tester) performance analysis and time-series monitoring",
    version="1.0.0",
    contact={
        "name": "FIO Analyzer",
        "url": "https://github.com/fio-analyzer"
    },
    lifespan=lifespan
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


# Include routers
app.include_router(test_runs.router, prefix="/api/test-runs", tags=["Test Runs"])
app.include_router(imports.router, prefix="/api/import", tags=["Import"])
app.include_router(time_series.router, prefix="/api/time-series", tags=["Time Series"])
app.include_router(utils_router.router, prefix="/api", tags=["Utils"])


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "OK",
        "timestamp": "2025-06-31T20:00:00Z",
        "version": "1.0.0"
    }


# Error handlers
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