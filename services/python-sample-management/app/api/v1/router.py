"""
API v1 Router
Combines all API routes and provides versioned endpoints
"""

from fastapi import APIRouter
from app.api.v1.endpoints import submissions, samples, health


# Create main API router with version prefix
api_router = APIRouter(prefix="/api/v1")

# Include all endpoint routers
api_router.include_router(
    submissions.router,
    prefix="/submissions",
    tags=["submissions"],
)

api_router.include_router(
    samples.router,
    prefix="/samples",
    tags=["samples"],
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"],
) 