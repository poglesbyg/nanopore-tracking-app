"""
Health Check Endpoints
Provides health and readiness checks for the service
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from datetime import datetime
import os

from app.core.dependencies import get_db_session


router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def health_check() -> Dict[str, Any]:
    """
    Basic health check endpoint
    Returns service status and metadata
    """
    return {
        "status": "healthy",
        "service": "sample-management",
        "version": os.getenv("SERVICE_VERSION", "1.0.0"),
        "timestamp": datetime.utcnow().isoformat(),
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@router.get("/ready", response_model=Dict[str, Any])
async def readiness_check(
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Readiness check endpoint
    Verifies database connectivity and other dependencies
    """
    checks = {
        "database": False,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    # Check database connectivity
    try:
        await db.execute("SELECT 1")
        checks["database"] = True
    except Exception as e:
        checks["database_error"] = str(e)
    
    # Overall readiness
    checks["ready"] = all([
        checks["database"],
        # Add other dependency checks here
    ])
    
    return checks


@router.get("/live", response_model=Dict[str, Any])
async def liveness_check() -> Dict[str, Any]:
    """
    Liveness check endpoint
    Simple check to verify the service is running
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
    } 