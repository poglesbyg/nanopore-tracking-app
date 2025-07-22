# Sample Management Service

A professional, modular Python microservice for managing nanopore sequencing samples and submissions.

## Architecture Overview

This service follows clean architecture principles with clear separation of concerns:

```
app/
├── api/                    # API layer (REST endpoints)
│   └── v1/                # API versioning
│       ├── endpoints/     # Route handlers
│       └── router.py      # Main API router
├── core/                  # Core business logic
│   ├── config.py         # Configuration management
│   ├── dependencies.py   # Dependency injection
│   ├── exceptions.py     # Custom exceptions
│   └── logging.py        # Structured logging
├── domain/               # Domain layer
│   ├── base.py          # Base classes and interfaces
│   ├── entities/        # Domain entities
│   ├── services/        # Domain services
│   └── specifications/  # Business rules
├── infrastructure/       # Infrastructure layer
│   ├── database/        # Database connections
│   ├── repositories/    # Data access layer
│   └── external/        # External service clients
├── tests/               # Test suite
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
└── utils/              # Utility functions
```

## Key Features

### 1. **Clean Architecture**
- Clear separation between domain logic and infrastructure
- Dependency injection for loose coupling
- Interface-based design for testability

### 2. **Configuration Management**
- Environment-based configuration with Pydantic
- Type-safe settings with validation
- Support for multiple environments (dev, staging, prod)

### 3. **Structured Logging**
- JSON-formatted logs for production
- Human-readable logs for development
- Request correlation IDs
- Performance metrics logging

### 4. **Error Handling**
- Custom exception hierarchy
- Standardized error responses
- Detailed error tracking in development
- Safe error messages in production

### 5. **API Design**
- RESTful API with versioning
- OpenAPI/Swagger documentation
- Request validation with Pydantic
- Consistent response formats

### 6. **Database Management**
- Async SQLAlchemy with connection pooling
- Repository pattern for data access
- Unit of Work pattern for transactions
- Database migrations with Alembic

### 7. **Testing**
- Comprehensive test coverage
- Unit tests for business logic
- Integration tests for API endpoints
- Test fixtures and factories

## Getting Started

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. Start the service:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 3002
```

## Configuration

The service uses environment variables for configuration. Key settings:

```env
# Environment
ENVIRONMENT=development
DEBUG=true

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=nanopore_samples

# Service
SERVICE_NAME=sample-management
SERVICE_VERSION=1.0.0
SERVICE_HOST=0.0.0.0
SERVICE_PORT=3002

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## API Documentation

When the service is running, API documentation is available at:
- Swagger UI: http://localhost:3002/docs
- ReDoc: http://localhost:3002/redoc
- OpenAPI Schema: http://localhost:3002/openapi.json

## Development

### Code Structure

#### Domain Layer
Contains pure business logic without any framework dependencies:
```python
# domain/entities/sample.py
class Sample(BaseEntity):
    submission_id: str
    sample_name: str
    sample_type: SampleType
    status: SampleStatus
    # ... other fields
```

#### Repository Layer
Handles data persistence:
```python
# infrastructure/repositories/sample_repository.py
class SampleRepository(BaseRepository[Sample, str]):
    async def get_by_submission(self, submission_id: str) -> List[Sample]:
        # Implementation
```

#### Service Layer
Orchestrates business operations:
```python
# domain/services/sample_service.py
class SampleService:
    def __init__(self, repository: ISampleRepository):
        self.repository = repository
    
    async def process_sample(self, sample_id: str) -> Sample:
        # Business logic
```

#### API Layer
Handles HTTP requests:
```python
# api/v1/endpoints/samples.py
@router.post("/", response_model=SampleResponse)
async def create_sample(
    sample: SampleCreate,
    service: SampleService = Depends(get_sample_service)
):
    return await service.create_sample(sample)
```

### Testing

Run tests with pytest:
```bash
# All tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/unit/test_sample_service.py
```

### Code Quality

The project uses several tools for code quality:
```bash
# Format code
black app tests

# Sort imports
isort app tests

# Type checking
mypy app

# Linting
flake8 app tests
pylint app

# Security checks
bandit -r app
```

## Deployment

### Docker

Build and run with Docker:
```bash
docker build -t sample-management:latest .
docker run -p 3002:3002 --env-file .env sample-management:latest
```

### Kubernetes/OpenShift

Deploy to Kubernetes:
```bash
kubectl apply -f deployment/k8s/
```

## Monitoring

The service provides several endpoints for monitoring:
- `/api/v1/health` - Basic health check
- `/api/v1/health/ready` - Readiness check (includes DB connectivity)
- `/api/v1/health/live` - Liveness check
- `/metrics` - Prometheus metrics (if enabled)

## Best Practices

1. **Always use type hints** - Helps with IDE support and catches errors early
2. **Write tests first** - TDD approach for better design
3. **Use dependency injection** - Makes code testable and maintainable
4. **Follow SOLID principles** - Especially Single Responsibility and Dependency Inversion
5. **Document your code** - Use docstrings for all public functions
6. **Handle errors gracefully** - Use custom exceptions for different error scenarios
7. **Log appropriately** - Use structured logging with appropriate levels
8. **Validate inputs** - Use Pydantic models for request/response validation

## Contributing

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass and code quality checks pass
4. Submit a pull request

## License

[Your License Here] 