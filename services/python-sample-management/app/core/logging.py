"""
Structured logging configuration using structlog
Provides consistent, JSON-formatted logs with context propagation
"""

import logging
import sys
from typing import Any, Dict, Optional
import structlog
from structlog.processors import CallsiteParameter
from structlog.stdlib import BoundLogger
import json
from datetime import datetime
import os


def setup_logging(
    level: str = "INFO",
    format: str = "json",
    service_name: str = "sample-management",
    environment: str = "development",
    include_hostname: bool = True,
    include_process_info: bool = True,
) -> BoundLogger:
    """
    Configure structured logging for the application
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format: Output format ("json" or "console")
        service_name: Name of the service for log context
        environment: Current environment (development, staging, production)
        include_hostname: Include hostname in logs
        include_process_info: Include process/thread info in logs
    
    Returns:
        Configured structlog logger
    """
    
    # Configure Python's logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper()),
    )
    
    # Base processors that run for all log entries
    base_processors = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
    ]
    
    # Add optional processors
    if include_hostname:
        base_processors.append(add_hostname)
    
    if include_process_info:
        base_processors.extend([
            structlog.processors.ProcessorFormatter.wrap_for_formatter,
            add_process_info,
        ])
    
    # Add service context
    base_processors.append(lambda _, __, event_dict: add_service_context(
        event_dict, service_name, environment
    ))
    
    # Development vs production processors
    if format == "console" or environment == "development":
        # Human-readable console output for development
        processors = base_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ]
        
        formatter = structlog.dev.ConsoleRenderer(
            colors=True,
            pad_event=30,
            exception_formatter=structlog.dev.RichTracebackFormatter(
                show_locals=True,
                max_frames=5,
            ),
        )
    else:
        # JSON output for production
        processors = base_processors + [
            structlog.processors.format_exc_info,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
        formatter = None
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Create and return logger
    return structlog.get_logger()


def add_hostname(_, __, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add hostname to log entry"""
    import socket
    event_dict["hostname"] = socket.gethostname()
    return event_dict


def add_process_info(_, __, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add process and thread information to log entry"""
    import os
    import threading
    
    event_dict["process_id"] = os.getpid()
    event_dict["thread_id"] = threading.get_ident()
    event_dict["thread_name"] = threading.current_thread().name
    return event_dict


def add_service_context(
    event_dict: Dict[str, Any],
    service_name: str,
    environment: str
) -> Dict[str, Any]:
    """Add service-specific context to log entry"""
    event_dict["service"] = service_name
    event_dict["environment"] = environment
    return event_dict


class LoggerAdapter:
    """
    Adapter class to provide additional logging utilities
    """
    
    def __init__(self, logger: BoundLogger):
        self.logger = logger
    
    def with_context(self, **kwargs) -> BoundLogger:
        """Create a new logger with additional context"""
        return self.logger.bind(**kwargs)
    
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        **kwargs
    ):
        """Log HTTP request with standard fields"""
        self.logger.info(
            "http_request",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            **kwargs
        )
    
    def log_db_query(
        self,
        query: str,
        duration_ms: float,
        rows_affected: Optional[int] = None,
        **kwargs
    ):
        """Log database query with standard fields"""
        self.logger.debug(
            "db_query",
            query=query[:200],  # Truncate long queries
            duration_ms=duration_ms,
            rows_affected=rows_affected,
            **kwargs
        )
    
    def log_error(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Log error with exception details"""
        error_dict = {
            "error_type": type(error).__name__,
            "error_message": str(error),
        }
        
        if context:
            error_dict["error_context"] = context
        
        self.logger.error(
            "error_occurred",
            exc_info=error,
            **error_dict,
            **kwargs
        )
    
    def log_event(
        self,
        event_name: str,
        event_data: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Log a business event"""
        self.logger.info(
            event_name,
            event_data=event_data or {},
            **kwargs
        )


class RequestLogger:
    """
    Middleware for logging HTTP requests
    """
    
    def __init__(self, logger: LoggerAdapter):
        self.logger = logger
    
    async def __call__(self, request, call_next):
        """Log request and response"""
        import time
        from starlette.requests import Request
        
        start_time = time.time()
        
        # Add request ID to context
        request_id = request.headers.get("X-Request-ID", str(os.urandom(16).hex()))
        request.state.request_id = request_id
        
        # Create logger with request context
        request_logger = self.logger.with_context(
            request_id=request_id,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
        )
        
        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000
            
            request_logger.log_request(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
            
            return response
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            request_logger.log_error(
                e,
                context={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                }
            )
            raise


# Global logger instance
_logger: Optional[LoggerAdapter] = None


def get_logger() -> LoggerAdapter:
    """Get the global logger instance"""
    global _logger
    if _logger is None:
        base_logger = setup_logging()
        _logger = LoggerAdapter(base_logger)
    return _logger


# Convenience export
logger = get_logger() 