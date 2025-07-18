"""Application configuration using Pydantic settings."""
import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, AnyUrl


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Server settings
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")
    
    # Database settings
    database_url: str = Field(default="postgresql://localhost/test", env="DATABASE_URL")
    
    # File processing settings
    max_file_size: int = Field(default=100 * 1024 * 1024, env="MAX_FILE_SIZE")  # 100MB
    allowed_file_types: List[str] = Field(
        default=["application/pdf", "text/csv"],
        env="ALLOWED_FILE_TYPES"
    )
    
    # Memory optimization settings
    csv_chunk_size: int = Field(default=100, env="CSV_CHUNK_SIZE")
    pdf_max_pages: int = Field(default=1000, env="PDF_MAX_PAGES")
    
    # API settings
    api_prefix: str = Field(default="/api/v1", env="API_PREFIX")
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001,https://nanopore-frontend-final-dept-barc.apps.cloudapps.unc.edu,https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu",
        env="CORS_ORIGINS"
    )
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from environment variable or use defaults."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    # Logging settings
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        env="LOG_FORMAT"
    )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create a singleton instance
settings = Settings() 