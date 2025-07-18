"""
Configuration management for Sample Management Service
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from functools import lru_cache
import os
from pathlib import Path


class DatabaseConfig(BaseModel):
    """Database configuration"""
    host: str = Field(default="localhost")
    port: int = Field(default=5432)
    user: str = Field(default="postgres")
    password: str
    database: str = Field(default="nanopore_samples")
    
    # Connection pool settings
    pool_min_size: int = Field(default=10)
    pool_max_size: int = Field(default=20)
    pool_timeout: int = Field(default=30)
    
    @property
    def url(self) -> str:
        """Construct database URL"""
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


class ServiceConfig(BaseModel):
    """Service configuration"""
    name: str = Field(default="sample-management")
    version: str = Field(default="1.0.0")
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=3002)
    
    # CORS settings
    cors_origins: List[str] = Field(default=["http://localhost:3000", "http://localhost:3001"])
    cors_allow_credentials: bool = Field(default=True)
    cors_allow_methods: List[str] = Field(default=["*"])
    cors_allow_headers: List[str] = Field(default=["*"])
    
    # Feature flags
    enable_metrics: bool = Field(default=True)
    enable_docs: bool = Field(default=True)
    enable_debug: bool = Field(default=False)


class LoggingConfig(BaseModel):
    """Logging configuration"""
    level: str = Field(default="INFO")
    format: str = Field(default="json")
    file: Optional[Path] = Field(default=None)
    
    # Structured logging
    include_hostname: bool = Field(default=True)
    include_process_info: bool = Field(default=True)


class Settings(BaseModel):
    """Main settings class"""
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    
    # Sub-configurations
    database: DatabaseConfig
    service: ServiceConfig = ServiceConfig()
    logging: LoggingConfig = LoggingConfig()
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def load_settings() -> Settings:
    """Load settings from environment variables"""
    # Database configuration from env vars
    db_config = DatabaseConfig(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "nanopore_samples"),
        pool_min_size=int(os.getenv("DB_POOL_MIN_SIZE", "10")),
        pool_max_size=int(os.getenv("DB_POOL_MAX_SIZE", "20")),
    )
    
    # Service configuration
    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
    service_config = ServiceConfig(
        name=os.getenv("SERVICE_NAME", "sample-management"),
        version=os.getenv("SERVICE_VERSION", "1.0.0"),
        host=os.getenv("SERVICE_HOST", "0.0.0.0"),
        port=int(os.getenv("SERVICE_PORT", "3002")),
        cors_origins=cors_origins.split(","),
        enable_metrics=os.getenv("ENABLE_METRICS", "true").lower() == "true",
        enable_docs=os.getenv("ENABLE_DOCS", "true").lower() == "true",
        enable_debug=os.getenv("ENABLE_DEBUG", "false").lower() == "true",
    )
    
    # Logging configuration
    log_file = os.getenv("LOG_FILE")
    logging_config = LoggingConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format=os.getenv("LOG_FORMAT", "json"),
        file=Path(log_file) if log_file else None,
    )
    
    return Settings(
        environment=os.getenv("ENVIRONMENT", "development"),
        debug=os.getenv("DEBUG", "false").lower() == "true",
        database=db_config,
        service=service_config,
        logging=logging_config,
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return load_settings()


# Convenience access
settings = get_settings() 