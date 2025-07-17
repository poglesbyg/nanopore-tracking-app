# Modular Architecture - Nanopore Submission Service

## Overview

The submission service has been refactored into a clean, modular architecture following best practices for Python web services.

## Directory Structure

```
submission-service/
├── app/                      # Main application package
│   ├── __init__.py
│   ├── main.py              # FastAPI application setup
│   ├── api/                 # API routes and endpoints
│   │   ├── __init__.py
│   │   └── routes.py        # API endpoint definitions
│   ├── core/                # Core configuration and settings
│   │   ├── __init__.py
│   │   └── config.py        # Pydantic settings management
│   ├── models/              # Data models and schemas
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic models
│   ├── services/            # Business logic services
│   │   ├── __init__.py
│   │   ├── pdf_processor.py # PDF processing service
│   │   └── csv_processor.py # CSV processing service
│   ├── db/                  # Database layer (future)
│   └── utils/               # Utility functions (future)
├── tests/                   # Test suite
│   ├── __init__.py
│   ├── conftest.py         # Pytest fixtures
│   ├── unit/               # Unit tests
│   │   ├── test_models.py
│   │   ├── test_pdf_processor.py
│   │   └── test_csv_processor.py
│   └── integration/        # Integration tests
│       └── test_api.py
├── app.py                  # Entry point
├── requirements.txt        # Dependencies
├── pytest.ini             # Pytest configuration
└── run_tests.sh          # Test runner script
```

## Key Components

### 1. Configuration Management (`app/core/config.py`)
- Centralized configuration using Pydantic Settings
- Environment variable support
- Type-safe configuration values
- Easy to extend and maintain

### 2. Data Models (`app/models/schemas.py`)
- Pydantic models for request/response validation
- Strong typing for all data structures
- Automatic validation and serialization
- Clear separation of concerns

### 3. Business Logic Services
- **PDF Processor**: Memory-optimized PDF text extraction
- **CSV Processor**: Chunked CSV processing for large files
- Clean interfaces with dependency injection ready
- Easy to test and mock

### 4. API Layer (`app/api/routes.py`)
- RESTful endpoints using FastAPI
- Automatic OpenAPI documentation
- Request validation
- Consistent error handling

### 5. Testing Framework
- Comprehensive unit tests for all components
- Integration tests for API endpoints
- Fixtures for test data
- Coverage reporting

## Benefits of Modular Architecture

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Components can be tested in isolation
3. **Scalability**: Easy to add new features without affecting existing code
4. **Reusability**: Services can be reused across different endpoints
5. **Type Safety**: Full type hints throughout the codebase

## Running Tests

```bash
# Run all tests
./run_tests.sh

# Run specific test categories
pytest tests/unit -v
pytest tests/integration -v

# Run with coverage
pytest --cov=app --cov-report=html
```

## Memory Optimization Features

1. **Chunked Processing**: CSV files processed in configurable chunks
2. **Page-by-Page PDF**: PDFs processed one page at a time
3. **Streaming Responses**: Large results can be streamed
4. **Resource Cleanup**: Proper cleanup of file handles and memory

## Configuration

Environment variables are managed through Pydantic Settings:

```python
# Example .env file
DATABASE_URL=postgresql://user:pass@localhost/db
MAX_FILE_SIZE=104857600  # 100MB
CSV_CHUNK_SIZE=100
PDF_MAX_PAGES=1000
LOG_LEVEL=INFO
```

## API Documentation

When running, visit:
- `/docs` - Interactive Swagger UI
- `/redoc` - Alternative API documentation

## Future Enhancements

1. **Database Layer**: Add SQLAlchemy models and repositories
2. **Background Tasks**: Celery integration for async processing
3. **Caching**: Redis integration for performance
4. **Monitoring**: Prometheus metrics
5. **API Versioning**: Support multiple API versions 