"""
Custom Exception Classes and Error Handling
Provides a structured way to handle errors throughout the application
"""

from typing import Optional, Dict, Any, List
from enum import Enum
from datetime import datetime
import traceback


class ErrorCode(str, Enum):
    """Standard error codes for the application"""
    
    # General errors (1000-1999)
    INTERNAL_ERROR = "ERR_1000"
    VALIDATION_ERROR = "ERR_1001"
    NOT_FOUND = "ERR_1002"
    ALREADY_EXISTS = "ERR_1003"
    UNAUTHORIZED = "ERR_1004"
    FORBIDDEN = "ERR_1005"
    BAD_REQUEST = "ERR_1006"
    CONFLICT = "ERR_1007"
    
    # Database errors (2000-2999)
    DATABASE_ERROR = "ERR_2000"
    DATABASE_CONNECTION_ERROR = "ERR_2001"
    DATABASE_TIMEOUT = "ERR_2002"
    CONSTRAINT_VIOLATION = "ERR_2003"
    
    # Business logic errors (3000-3999)
    INVALID_SAMPLE_STATE = "ERR_3000"
    INVALID_WORKFLOW_TRANSITION = "ERR_3001"
    SAMPLE_NOT_READY = "ERR_3002"
    SUBMISSION_LOCKED = "ERR_3003"
    QUOTA_EXCEEDED = "ERR_3004"
    
    # External service errors (4000-4999)
    EXTERNAL_SERVICE_ERROR = "ERR_4000"
    AI_SERVICE_ERROR = "ERR_4001"
    FILE_STORAGE_ERROR = "ERR_4002"
    NOTIFICATION_ERROR = "ERR_4003"


class BaseError(Exception):
    """
    Base exception class for all custom exceptions
    Provides structured error information
    """
    
    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        inner_exception: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        self.inner_exception = inner_exception
        self.timestamp = datetime.utcnow()
        self.traceback = traceback.format_exc() if inner_exception else None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        error_dict = {
            "error": {
                "code": self.code.value,
                "message": self.message,
                "timestamp": self.timestamp.isoformat(),
            }
        }
        
        if self.details:
            error_dict["error"]["details"] = self.details
        
        # Include traceback in development mode
        if self.traceback and self._include_traceback():
            error_dict["error"]["traceback"] = self.traceback
        
        return error_dict
    
    def _include_traceback(self) -> bool:
        """Determine if traceback should be included"""
        import os
        return os.getenv("ENVIRONMENT", "development") == "development"


# Specific exception classes

class ValidationError(BaseError):
    """Raised when input validation fails"""
    
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        value: Optional[Any] = None,
        errors: Optional[List[Dict[str, Any]]] = None,
    ):
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = str(value)
        if errors:
            details["validation_errors"] = errors
        
        super().__init__(
            message=message,
            code=ErrorCode.VALIDATION_ERROR,
            status_code=400,
            details=details,
        )


class NotFoundError(BaseError):
    """Raised when a resource is not found"""
    
    def __init__(
        self,
        resource_type: str,
        resource_id: Optional[str] = None,
        message: Optional[str] = None,
    ):
        if not message:
            message = f"{resource_type} not found"
            if resource_id:
                message += f": {resource_id}"
        
        super().__init__(
            message=message,
            code=ErrorCode.NOT_FOUND,
            status_code=404,
            details={
                "resource_type": resource_type,
                "resource_id": resource_id,
            },
        )


class AlreadyExistsError(BaseError):
    """Raised when trying to create a resource that already exists"""
    
    def __init__(
        self,
        resource_type: str,
        identifier: str,
        message: Optional[str] = None,
    ):
        if not message:
            message = f"{resource_type} already exists: {identifier}"
        
        super().__init__(
            message=message,
            code=ErrorCode.ALREADY_EXISTS,
            status_code=409,
            details={
                "resource_type": resource_type,
                "identifier": identifier,
            },
        )


class UnauthorizedError(BaseError):
    """Raised when authentication is required but not provided"""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code=ErrorCode.UNAUTHORIZED,
            status_code=401,
        )


class ForbiddenError(BaseError):
    """Raised when user doesn't have permission to access resource"""
    
    def __init__(
        self,
        message: str = "Access forbidden",
        resource: Optional[str] = None,
        action: Optional[str] = None,
    ):
        details = {}
        if resource:
            details["resource"] = resource
        if action:
            details["action"] = action
        
        super().__init__(
            message=message,
            code=ErrorCode.FORBIDDEN,
            status_code=403,
            details=details,
        )


class DatabaseError(BaseError):
    """Raised when database operations fail"""
    
    def __init__(
        self,
        message: str,
        operation: Optional[str] = None,
        query: Optional[str] = None,
        inner_exception: Optional[Exception] = None,
    ):
        details = {}
        if operation:
            details["operation"] = operation
        if query:
            details["query"] = query[:200]  # Truncate long queries
        
        super().__init__(
            message=message,
            code=ErrorCode.DATABASE_ERROR,
            status_code=500,
            details=details,
            inner_exception=inner_exception,
        )


class BusinessLogicError(BaseError):
    """Base class for business logic errors"""
    
    def __init__(
        self,
        message: str,
        code: ErrorCode,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            code=code,
            status_code=400,
            details=details,
        )


class InvalidSampleStateError(BusinessLogicError):
    """Raised when sample is in invalid state for requested operation"""
    
    def __init__(
        self,
        sample_id: str,
        current_state: str,
        requested_operation: str,
        allowed_states: Optional[List[str]] = None,
    ):
        details = {
            "sample_id": sample_id,
            "current_state": current_state,
            "requested_operation": requested_operation,
        }
        if allowed_states:
            details["allowed_states"] = allowed_states
        
        super().__init__(
            message=f"Sample {sample_id} is in state '{current_state}' which is invalid for operation '{requested_operation}'",
            code=ErrorCode.INVALID_SAMPLE_STATE,
            details=details,
        )


class InvalidWorkflowTransitionError(BusinessLogicError):
    """Raised when invalid workflow transition is attempted"""
    
    def __init__(
        self,
        from_state: str,
        to_state: str,
        allowed_transitions: Optional[List[str]] = None,
    ):
        details = {
            "from_state": from_state,
            "to_state": to_state,
        }
        if allowed_transitions:
            details["allowed_transitions"] = allowed_transitions
        
        super().__init__(
            message=f"Invalid workflow transition from '{from_state}' to '{to_state}'",
            code=ErrorCode.INVALID_WORKFLOW_TRANSITION,
            details=details,
        )


class ExternalServiceError(BaseError):
    """Raised when external service calls fail"""
    
    def __init__(
        self,
        service_name: str,
        message: str,
        operation: Optional[str] = None,
        inner_exception: Optional[Exception] = None,
    ):
        details = {
            "service_name": service_name,
        }
        if operation:
            details["operation"] = operation
        
        super().__init__(
            message=f"External service error ({service_name}): {message}",
            code=ErrorCode.EXTERNAL_SERVICE_ERROR,
            status_code=502,
            details=details,
            inner_exception=inner_exception,
        )


# Error handler for FastAPI
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse


def setup_exception_handlers(app: FastAPI):
    """Configure exception handlers for FastAPI"""
    
    @app.exception_handler(BaseError)
    async def handle_base_error(request: Request, exc: BaseError):
        """Handle all custom exceptions"""
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )
    
    @app.exception_handler(ValueError)
    async def handle_value_error(request: Request, exc: ValueError):
        """Handle standard ValueError as validation error"""
        error = ValidationError(str(exc))
        return JSONResponse(
            status_code=error.status_code,
            content=error.to_dict(),
        )
    
    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        """Handle unexpected errors"""
        error = BaseError(
            message="An unexpected error occurred",
            inner_exception=exc,
        )
        
        # Log the error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Unexpected error: {exc}", exc_info=True)
        
        return JSONResponse(
            status_code=error.status_code,
            content=error.to_dict(),
        )


# Utility functions for error handling
def handle_database_error(exc: Exception) -> DatabaseError:
    """Convert database exceptions to DatabaseError"""
    from sqlalchemy.exc import (
        IntegrityError,
        OperationalError,
        DataError,
        DatabaseError as SQLAlchemyDatabaseError,
    )
    
    if isinstance(exc, IntegrityError):
        return DatabaseError(
            message="Database integrity constraint violated",
            operation="insert/update",
            inner_exception=exc,
        )
    elif isinstance(exc, OperationalError):
        return DatabaseError(
            message="Database operation failed",
            operation="query",
            inner_exception=exc,
        )
    elif isinstance(exc, DataError):
        return DatabaseError(
            message="Invalid data for database operation",
            operation="data_validation",
            inner_exception=exc,
        )
    else:
        return DatabaseError(
            message="Database error occurred",
            inner_exception=exc,
        ) 