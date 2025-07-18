"""
Standardized CORS middleware for Python FastAPI services.
This module provides a consistent CORS configuration across all Python microservices.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List


def get_cors_origins() -> List[str]:
    """Get CORS origins from environment variable with fallback defaults."""
    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
    return [origin.strip() for origin in origins.split(",")]


def get_cors_methods() -> List[str]:
    """Get CORS methods from environment variable with fallback defaults."""
    methods = os.getenv("CORS_METHODS", "GET,POST,PUT,DELETE,OPTIONS,PATCH")
    return [method.strip() for method in methods.split(",")]


def get_cors_headers() -> List[str]:
    """Get CORS headers from environment variable with fallback defaults."""
    headers = os.getenv("CORS_HEADERS", "Content-Type,Authorization,X-Requested-With,Accept,Origin")
    return [header.strip() for header in headers.split(",")]


def get_cors_credentials() -> bool:
    """Get CORS credentials setting from environment variable."""
    return os.getenv("CORS_CREDENTIALS", "true").lower() == "true"


def get_cors_max_age() -> int:
    """Get CORS max age from environment variable."""
    return int(os.getenv("CORS_MAX_AGE", "86400"))


def add_cors_middleware(app: FastAPI) -> None:
    """
    Add standardized CORS middleware to FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=get_cors_credentials(),
        allow_methods=get_cors_methods(),
        allow_headers=get_cors_headers(),
        max_age=get_cors_max_age(),
    )


# Configuration validation
def validate_cors_config() -> dict:
    """Validate CORS configuration and return current settings."""
    config = {
        "origins": get_cors_origins(),
        "methods": get_cors_methods(),
        "headers": get_cors_headers(),
        "credentials": get_cors_credentials(),
        "max_age": get_cors_max_age(),
    }
    
    # Basic validation
    if not config["origins"]:
        raise ValueError("CORS_ORIGINS cannot be empty")
    
    if not config["methods"]:
        raise ValueError("CORS_METHODS cannot be empty")
    
    return config


# Example usage:
# from cors_middleware import add_cors_middleware
# 
# app = FastAPI()
# add_cors_middleware(app) 