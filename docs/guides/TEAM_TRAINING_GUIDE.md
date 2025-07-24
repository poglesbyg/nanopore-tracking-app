# Team Training Guide: Python Microservices Architecture

## Overview

This guide provides comprehensive training materials for the development and operations teams transitioning to the new Python microservices architecture. The training is structured to build knowledge progressively from fundamentals to advanced operational procedures.

## Training Structure

### Phase 1: Foundation (Week 1)
- Python/FastAPI fundamentals
- Docker and containerization
- Microservices architecture principles

### Phase 2: Operations (Week 2)
- OpenShift deployment and management
- Monitoring and alerting
- Troubleshooting and maintenance

### Phase 3: Advanced Topics (Week 3)
- Performance optimization
- Security best practices
- Development workflows

## Phase 1: Foundation Training

### 1.1 Python/FastAPI Fundamentals

#### Learning Objectives
- Understand FastAPI framework architecture
- Master async/await programming patterns
- Implement Pydantic validation
- Create and consume API documentation

#### Key Concepts

**FastAPI Basics**
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Sample Service", version="1.0.0")

class SampleRequest(BaseModel):
    name: str
    priority: int = 1
    metadata: Optional[dict] = None

@app.post("/samples/", response_model=SampleResponse)
async def create_sample(sample: SampleRequest):
    """Create a new sample with validation"""
    # Business logic here
    return SampleResponse(id=1, **sample.dict())
```

**Async/Await Patterns**
```python
import asyncio
import aiohttp
from asyncpg import Connection

async def process_sample(sample_id: int, db: Connection):
    """Process sample asynchronously"""
    # Database operation
    sample = await db.fetchrow("SELECT * FROM samples WHERE id = $1", sample_id)
    
    # External API call
    async with aiohttp.ClientSession() as session:
        async with session.post("/api/process", json=sample) as response:
            result = await response.json()
    
    # Update database
    await db.execute("UPDATE samples SET status = $1 WHERE id = $2", 
                    "processed", sample_id)
    
    return result
```

**Pydantic Validation**
```python
from pydantic import BaseModel, validator, Field
from typing import List, Optional
from datetime import datetime

class SampleModel(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=100)
    priority: int = Field(default=1, ge=1, le=5)
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: Optional[dict] = None
    
    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
    
    class Config:
        schema_extra = {
            "example": {
                "name": "Sample-001",
                "priority": 2,
                "metadata": {"type": "nanopore", "batch": "B001"}
            }
        }
```

#### Hands-On Exercises

**Exercise 1: Create a Simple Service**
```python
# Create a basic FastAPI service with health check
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "training-service"}

# Run with: uvicorn main:app --reload
```

**Exercise 2: Add Database Integration**
```python
# Add PostgreSQL integration with asyncpg
import asyncpg
from fastapi import FastAPI, Depends

app = FastAPI()

async def get_db():
    conn = await asyncpg.connect("postgresql://user:pass@localhost/db")
    try:
        yield conn
    finally:
        await conn.close()

@app.get("/samples/")
async def get_samples(db: asyncpg.Connection = Depends(get_db)):
    samples = await db.fetch("SELECT * FROM samples")
    return [dict(sample) for sample in samples]
```

### 1.2 Docker and Containerization

#### Learning Objectives
- Build optimized Docker images
- Understand container lifecycle
- Implement health checks
- Use Docker Compose for local development

#### Key Concepts

**Dockerfile Best Practices**
```dockerfile
# Multi-stage build for optimization
FROM python:3.12-slim as builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim

# Create non-root user
RUN useradd --create-home --shell /bin/bash app

WORKDIR /app

# Copy only necessary files
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY src/ ./src/

# Set ownership
RUN chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Docker Compose for Development**
```yaml
version: '3.8'

services:
  sample-service:
    build: .
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/samples
    depends_on:
      - db
    volumes:
      - ./src:/app/src
    
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=samples
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

#### Hands-On Exercises

**Exercise 3: Build and Run Container**
```bash
# Build the image
docker build -t training-service .

# Run the container
docker run -p 8000:8000 training-service

# Check health
curl http://localhost:8000/health
```

**Exercise 4: Docker Compose Setup**
```bash
# Start services
docker-compose up -d

# Check logs
docker-compose logs -f sample-service

# Scale service
docker-compose up -d --scale sample-service=3
```

### 1.3 Microservices Architecture Principles

#### Learning Objectives
- Understand service boundaries
- Implement service communication
- Handle distributed data management
- Design for failure

#### Key Concepts

**Service Boundaries**
```python
# Sample Management Service - Handles sample lifecycle
class SampleService:
    async def create_sample(self, sample_data: dict):
        # Core sample creation logic
        pass
    
    async def update_sample_status(self, sample_id: int, status: str):
        # Status management
        pass

# AI Processing Service - Handles AI analysis
class AIService:
    async def process_pdf(self, file_path: str):
        # PDF processing logic
        pass
    
    async def analyze_sample(self, sample_id: int):
        # AI analysis logic
        pass
```

**Service Communication**
```python
import httpx
from typing import Optional

class ServiceClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient()
    
    async def call_service(self, endpoint: str, data: dict) -> Optional[dict]:
        try:
            response = await self.client.post(
                f"{self.base_url}/{endpoint}",
                json=data,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            # Handle network errors
            logger.error(f"Service call failed: {e}")
            return None
        except httpx.HTTPStatusError as e:
            # Handle HTTP errors
            logger.error(f"HTTP error: {e.response.status_code}")
            return None
```

**Circuit Breaker Pattern**
```python
import asyncio
from enum import Enum
from datetime import datetime, timedelta

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
    
    async def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        return (
            self.last_failure_time and
            datetime.now() - self.last_failure_time > timedelta(seconds=self.timeout)
        )
    
    def _on_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
```

## Phase 2: Operations Training

### 2.1 OpenShift Deployment and Management

#### Learning Objectives
- Deploy services to OpenShift
- Manage configurations and secrets
- Implement rolling updates
- Monitor resource usage

#### Key Concepts

**Deployment Configuration**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-service
  namespace: dept-barc
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sample-service
  template:
    metadata:
      labels:
        app: sample-service
    spec:
      containers:
      - name: sample-service
        image: sample-service:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Service and Route Configuration**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: sample-service
spec:
  selector:
    app: sample-service
  ports:
  - port: 80
    targetPort: 8000
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: sample-service
spec:
  to:
    kind: Service
    name: sample-service
  tls:
    termination: edge
```

#### Hands-On Exercises

**Exercise 5: Deploy to OpenShift**
```bash
# Login to OpenShift
oc login --token=<token> --server=<server>

# Create deployment
oc apply -f deployment.yaml

# Check status
oc get pods -l app=sample-service

# View logs
oc logs -f deployment/sample-service

# Scale deployment
oc scale deployment sample-service --replicas=5
```

**Exercise 6: Rolling Update**
```bash
# Update image
oc set image deployment/sample-service sample-service=sample-service:v2

# Check rollout status
oc rollout status deployment/sample-service

# Rollback if needed
oc rollout undo deployment/sample-service
```

### 2.2 Monitoring and Alerting

#### Learning Objectives
- Set up Prometheus monitoring
- Create Grafana dashboards
- Configure alerts
- Analyze metrics

#### Key Concepts

**Prometheus Metrics**
```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time

# Define metrics
REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Active database connections')

# Instrument code
@REQUEST_DURATION.time()
async def process_request():
    REQUEST_COUNT.labels(method='POST', endpoint='/samples').inc()
    # Process request
    pass

# Start metrics server
start_http_server(8080)
```

**Custom Metrics**
```python
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

# Add automatic instrumentation
instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)

# Custom metrics
from prometheus_client import Counter, Histogram

SAMPLE_PROCESSING_TIME = Histogram(
    'sample_processing_duration_seconds',
    'Time spent processing samples'
)

SAMPLE_STATUS_CHANGES = Counter(
    'sample_status_changes_total',
    'Total sample status changes',
    ['from_status', 'to_status']
)

@app.post("/samples/{sample_id}/status")
async def update_sample_status(sample_id: int, new_status: str):
    # Get current status
    current_status = await get_sample_status(sample_id)
    
    # Update status
    await update_status(sample_id, new_status)
    
    # Record metric
    SAMPLE_STATUS_CHANGES.labels(
        from_status=current_status,
        to_status=new_status
    ).inc()
    
    return {"status": "updated"}
```

#### Hands-On Exercises

**Exercise 7: Add Metrics to Service**
```python
# Add metrics to your training service
from prometheus_client import Counter, generate_latest

request_count = Counter('requests_total', 'Total requests')

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")

@app.get("/test")
async def test_endpoint():
    request_count.inc()
    return {"message": "test"}
```

**Exercise 8: Create Grafana Dashboard**
```json
{
  "dashboard": {
    "title": "Training Service Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      }
    ]
  }
}
```

### 2.3 Troubleshooting and Maintenance

#### Learning Objectives
- Analyze logs effectively
- Debug performance issues
- Handle service failures
- Perform routine maintenance

#### Key Concepts

**Structured Logging**
```python
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'service': 'sample-service',
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add extra fields
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
            
        return json.dumps(log_entry)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

# Usage
logger.info("Processing sample", extra={'user_id': 123, 'sample_id': 456})
```

**Error Handling**
```python
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

async def process_sample(sample_id: int):
    try:
        # Processing logic
        sample = await get_sample(sample_id)
        if not sample:
            raise HTTPException(status_code=404, detail="Sample not found")
        
        result = await process_sample_data(sample)
        
        logger.info(
            "Sample processed successfully",
            extra={'sample_id': sample_id, 'result': result}
        )
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            "Failed to process sample",
            extra={'sample_id': sample_id, 'error': str(e)},
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
```

#### Hands-On Exercises

**Exercise 9: Debug Service Issues**
```bash
# Check service status
oc get pods -l app=sample-service

# View logs
oc logs -f deployment/sample-service

# Debug specific pod
oc describe pod <pod-name>

# Execute commands in pod
oc exec -it <pod-name> -- /bin/bash

# Check resource usage
oc top pods
```

**Exercise 10: Performance Analysis**
```bash
# Monitor resource usage
oc adm top pods --containers

# Check service metrics
curl http://service-url/metrics

# Analyze database performance
oc exec -it postgres-pod -- psql -c "SELECT * FROM pg_stat_activity;"
```

## Phase 3: Advanced Topics

### 3.1 Performance Optimization

#### Learning Objectives
- Optimize database queries
- Implement caching strategies
- Profile application performance
- Scale services effectively

#### Key Concepts

**Database Optimization**
```python
import asyncpg
from typing import List, Optional

class OptimizedSampleRepository:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
    
    async def get_samples_batch(self, limit: int = 100, offset: int = 0) -> List[dict]:
        """Optimized batch retrieval with pagination"""
        async with self.pool.acquire() as conn:
            # Use prepared statement for better performance
            query = """
                SELECT id, name, status, created_at, metadata
                FROM samples
                WHERE status != 'deleted'
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            """
            rows = await conn.fetch(query, limit, offset)
            return [dict(row) for row in rows]
    
    async def get_samples_by_status(self, status: str) -> List[dict]:
        """Use index for status queries"""
        async with self.pool.acquire() as conn:
            # Ensure index exists: CREATE INDEX idx_samples_status ON samples(status)
            query = "SELECT * FROM samples WHERE status = $1"
            rows = await conn.fetch(query, status)
            return [dict(row) for row in rows]
```

**Caching Implementation**
```python
import redis.asyncio as redis
import json
from typing import Optional, Any

class CacheManager:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            # Log error but don't fail
            logger.warning(f"Cache get failed: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        try:
            await self.redis.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete failed: {e}")
            return False

# Usage with decorator
from functools import wraps

def cached(ttl: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached_result = await cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator

@cached(ttl=600)
async def get_sample_statistics():
    # Expensive calculation
    return await calculate_statistics()
```

### 3.2 Security Best Practices

#### Learning Objectives
- Implement authentication and authorization
- Secure API endpoints
- Handle sensitive data
- Follow security standards

#### Key Concepts

**JWT Authentication**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime, timedelta

security = HTTPBearer()

class AuthManager:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.algorithm = "HS256"
    
    def create_token(self, user_id: int, role: str) -> str:
        payload = {
            "user_id": user_id,
            "role": role,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

auth_manager = AuthManager("your-secret-key")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = auth_manager.verify_token(credentials.credentials)
    return payload

# Usage
@app.get("/protected")
async def protected_endpoint(user: dict = Depends(get_current_user)):
    return {"message": f"Hello user {user['user_id']}"}
```

**Input Validation and Sanitization**
```python
from pydantic import BaseModel, validator, Field
from typing import Optional
import re

class SampleInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    priority: int = Field(default=1, ge=1, le=5)
    metadata: Optional[dict] = None
    
    @validator('name')
    def validate_name(cls, v):
        # Remove potentially harmful characters
        sanitized = re.sub(r'[<>"\']', '', v.strip())
        if not sanitized:
            raise ValueError('Name cannot be empty after sanitization')
        return sanitized
    
    @validator('metadata')
    def validate_metadata(cls, v):
        if v is None:
            return v
        
        # Limit metadata size
        if len(str(v)) > 1000:
            raise ValueError('Metadata too large')
        
        # Check for sensitive keys
        sensitive_keys = ['password', 'secret', 'token']
        for key in v.keys():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                raise ValueError(f'Sensitive key not allowed: {key}')
        
        return v
```

### 3.3 Development Workflows

#### Learning Objectives
- Set up development environment
- Implement testing strategies
- Use CI/CD pipelines
- Follow code quality standards

#### Key Concepts

**Testing Strategy**
```python
import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

# Unit tests
class TestSampleService:
    @pytest.mark.asyncio
    async def test_create_sample(self):
        # Arrange
        sample_data = {"name": "Test Sample", "priority": 1}
        
        # Mock dependencies
        mock_db = AsyncMock()
        mock_db.fetchrow.return_value = {"id": 1, **sample_data}
        
        service = SampleService(mock_db)
        
        # Act
        result = await service.create_sample(sample_data)
        
        # Assert
        assert result["id"] == 1
        assert result["name"] == "Test Sample"
        mock_db.execute.assert_called_once()

# Integration tests
class TestSampleAPI:
    @pytest.mark.asyncio
    async def test_create_sample_endpoint(self):
        async with AsyncClient(app=app, base_url="http://test") as ac:
            response = await ac.post("/samples/", json={
                "name": "Test Sample",
                "priority": 2
            })
        
        assert response.status_code == 201
        assert response.json()["name"] == "Test Sample"

# Performance tests
class TestPerformance:
    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        async def make_request():
            async with AsyncClient(app=app, base_url="http://test") as ac:
                response = await ac.get("/health")
                return response.status_code
        
        # Test 100 concurrent requests
        tasks = [make_request() for _ in range(100)]
        results = await asyncio.gather(*tasks)
        
        # All requests should succeed
        assert all(status == 200 for status in results)
```

**CI/CD Pipeline**
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: 3.12
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-asyncio
    
    - name: Run tests
      run: pytest tests/ -v
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost/test
    
    - name: Run linting
      run: |
        pip install flake8 black
        flake8 src/
        black --check src/
  
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: docker build -t sample-service:${{ github.sha }} .
    
    - name: Push to registry
      run: |
        docker tag sample-service:${{ github.sha }} registry.example.com/sample-service:${{ github.sha }}
        docker push registry.example.com/sample-service:${{ github.sha }}
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to OpenShift
      run: |
        oc login --token=${{ secrets.OPENSHIFT_TOKEN }} --server=${{ secrets.OPENSHIFT_SERVER }}
        oc set image deployment/sample-service sample-service=registry.example.com/sample-service:${{ github.sha }}
        oc rollout status deployment/sample-service
```

## Practical Exercises

### Exercise 11: Complete Service Implementation
Create a complete microservice with:
- FastAPI application
- Database integration
- Authentication
- Metrics
- Tests
- Docker configuration

### Exercise 12: Local Development Setup
Set up a complete local development environment:
- Docker Compose with all services
- Database with test data
- Monitoring stack
- Development tools

### Exercise 13: Deployment Simulation
Practice deployment procedures:
- Build and push images
- Deploy to OpenShift
- Configure monitoring
- Test rollback procedures

## Assessment and Certification

### Knowledge Check
1. **FastAPI Fundamentals** (20 questions)
2. **Docker and Containerization** (15 questions)
3. **OpenShift Operations** (20 questions)
4. **Monitoring and Troubleshooting** (15 questions)
5. **Security and Best Practices** (10 questions)

### Practical Assessment
1. **Service Implementation** - Create a functional microservice
2. **Deployment** - Deploy service to OpenShift
3. **Monitoring Setup** - Configure metrics and alerts
4. **Troubleshooting** - Debug and fix issues
5. **Performance Optimization** - Improve service performance

### Certification Requirements
- Pass knowledge check with 80% or higher
- Complete all practical assessments
- Demonstrate troubleshooting skills
- Show understanding of operational procedures

## Resources and References

### Documentation
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenShift Documentation](https://docs.openshift.com/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Docker Documentation](https://docs.docker.com/)

### Books
- "Microservices Patterns" by Chris Richardson
- "Building Microservices" by Sam Newman
- "Python Tricks" by Dan Bader
- "Site Reliability Engineering" by Google

### Online Courses
- FastAPI Course on Udemy
- OpenShift Administration
- Prometheus and Grafana Training
- Docker and Kubernetes

### Tools and Utilities
- **Development**: VS Code, PyCharm, Docker Desktop
- **Testing**: pytest, httpx, testcontainers
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Security**: bandit, safety, semgrep

## Support and Community

### Internal Support
- **Technical Lead**: Available for architecture questions
- **DevOps Team**: Deployment and infrastructure support
- **Security Team**: Security review and guidance

### External Resources
- **Stack Overflow**: Community Q&A
- **GitHub Issues**: Tool-specific support
- **Discord/Slack**: Real-time community help

### Regular Reviews
- Weekly team sync on progress
- Monthly architecture reviews
- Quarterly performance assessments
- Annual technology roadmap updates

## Conclusion

This training guide provides a comprehensive foundation for working with the new Python microservices architecture. The combination of theoretical knowledge and practical exercises ensures that team members can confidently develop, deploy, and maintain the new system.

The training is designed to be progressive, building from basic concepts to advanced operational procedures. Regular assessments and practical exercises ensure that knowledge is retained and can be applied effectively in real-world scenarios.

Success in this training program will enable the team to fully leverage the benefits of the new microservices architecture while maintaining high standards of reliability, security, and performance. 