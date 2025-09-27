"""
Logging utilities
"""

import json
import logging
from typing import Any, Dict, Optional


def setup_logging():
    """Setup application logging"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )


def log_info(message: str, context: Optional[Dict[str, Any]] = None):
    """Log info message with context"""
    logger = logging.getLogger(__name__)

    if context:
        logger.info(f"{message} - {json.dumps(context, default=str)}")
    else:
        logger.info(message)


def log_error(message: str, error: Exception, context: Optional[Dict[str, Any]] = None):
    """Log error message with context"""
    logger = logging.getLogger(__name__)

    error_context = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        **(context or {}),
    }

    logger.error(f"{message} - {json.dumps(error_context, default=str)}")


def log_warning(message: str, context: Optional[Dict[str, Any]] = None):
    """Log warning message with context"""
    logger = logging.getLogger(__name__)

    if context:
        logger.warning(f"{message} - {json.dumps(context, default=str)}")
    else:
        logger.warning(message)


def log_debug(message: str, context: Optional[Dict[str, Any]] = None):
    """Log debug message with context"""
    logger = logging.getLogger(__name__)

    if context:
        logger.debug(f"{message} - {json.dumps(context, default=str)}")
    else:
        logger.debug(message)
