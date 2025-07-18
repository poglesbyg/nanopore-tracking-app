"""
Python API Gateway for Nanopore Tracking App Microservices
FastAPI-based central routing, authentication, and load balancing
"""

from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
import httpx
import asyncio
import logging
import time
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
import uvicorn
from pydantic import BaseModel
import jwt
import os
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()

# Service registry
class ServiceConfig(BaseModel):
    name: str
    url: str
    port: int
    health_path: str = "/health"
    timeout: int = 10
    retries: int = 3
    is_healthy: bool = False
    last_health_check: Optional[datetime] = None

class ServiceRegistry:
    def __init__(self):
        self.services: Dict[str, ServiceConfig] = {}
        self.health_check_task: Optional[asyncio.Task] = None
        self.load_service_configs()
    
    def load_service_configs(self):
        """Load service configurations from environment variables"""
        services = [
            ServiceConfig(
                name="sample-management",
                url=os.getenv("SAMPLE_SERVICE_URL", "http://sample-management:8001"),
                port=8001
            ),
            ServiceConfig(
                name="ai-processing",
                url=os.getenv("AI_SERVICE_URL", "http://ai-processing:8002"),
                port=8002
            ),
            ServiceConfig(
                name="authentication",
                url=os.getenv("AUTH_SERVICE_URL", "http://authentication:8003"),
                port=8003
            ),
            ServiceConfig(
                name="file-storage",
                url=os.getenv("FILE_SERVICE_URL", "http://file-storage:8004"),
                port=8004
            ),
            ServiceConfig(
                name="audit",
                url=os.getenv("AUDIT_SERVICE_URL", "http://audit:8005"),
                port=8005
            ),
            ServiceConfig(
                name="submission",
                url=os.getenv("SUBMISSION_SERVICE_URL", "http://submission:8006"),
                port=8006
            )
        ]
        
        for service in services:
            self.services[service.name] = service
    
    async def check_service_health(self, service: ServiceConfig) -> bool:
        """Check if a service is healthy"""
        try:
            async with httpx.AsyncClient(timeout=service.timeout) as client:
                response = await client.get(f"{service.url}{service.health_path}")
                is_healthy = response.status_code == 200
                service.is_healthy = is_healthy
                service.last_health_check = datetime.now()
                return is_healthy
        except Exception as e:
            logger.warning(f"Health check failed for {service.name}: {e}")
            service.is_healthy = False
            service.last_health_check = datetime.now()
            return False
    
    async def perform_health_checks(self):
        """Perform health checks for all services"""
        tasks = [
            self.check_service_health(service)
            for service in self.services.values()
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def start_health_monitoring(self):
        """Start periodic health checks"""
        while True:
            await self.perform_health_checks()
            await asyncio.sleep(30)  # Check every 30 seconds
    
    def get_healthy_service(self, service_name: str) -> Optional[ServiceConfig]:
        """Get a healthy service by name"""
        service = self.services.get(service_name)
        if service and service.is_healthy:
            return service
        return None
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        return {
            "timestamp": datetime.now().isoformat(),
            "total_services": len(self.services),
            "healthy_services": sum(1 for s in self.services.values() if s.is_healthy),
            "services": {
                name: {
                    "url": service.url,
                    "is_healthy": service.is_healthy,
                    "last_health_check": service.last_health_check.isoformat() if service.last_health_check else None
                }
                for name, service in self.services.items()
            }
        }

# Global service registry
service_registry = ServiceRegistry()

# JWT Authentication
class AuthManager:
    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid token")
            return None

auth_manager = AuthManager()

# Request proxy
class RequestProxy:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def proxy_request(
        self,
        method: str,
        service_name: str,
        path: str,
        headers: Dict[str, str],
        body: Optional[bytes] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> httpx.Response:
        """Proxy request to a microservice"""
        service = service_registry.get_healthy_service(service_name)
        if not service:
            raise HTTPException(
                status_code=503,
                detail=f"Service {service_name} is not available"
            )
        
        # Add correlation ID
        correlation_id = headers.get("x-correlation-id", f"gw-{int(time.time())}-{id(asyncio.current_task())}")
        headers["x-correlation-id"] = correlation_id
        headers["x-gateway-timestamp"] = datetime.now().isoformat()
        
        # Build target URL
        target_url = f"{service.url}{path}"
        
        logger.info(f"Proxying {method} request to {service_name}: {target_url}")
        
        try:
            response = await self.client.request(
                method=method,
                url=target_url,
                headers=headers,
                content=body,
                params=params
            )
            return response
        except httpx.RequestError as e:
            logger.error(f"Request failed to {service_name}: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Service {service_name} request failed"
            )
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

# Global request proxy
request_proxy = RequestProxy()

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Python API Gateway...")
    
    # Start health monitoring
    service_registry.health_check_task = asyncio.create_task(
        service_registry.start_health_monitoring()
    )
    
    # Initial health check
    await service_registry.perform_health_checks()
    
    logger.info("API Gateway started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down API Gateway...")
    
    # Cancel health monitoring
    if service_registry.health_check_task:
        service_registry.health_check_task.cancel()
        try:
            await service_registry.health_check_task
        except asyncio.CancelledError:
            pass
    
    # Close HTTP client
    await request_proxy.close()
    
    logger.info("API Gateway shutdown complete")

# FastAPI app
app = FastAPI(
    title="Nanopore Tracking API Gateway",
    description="Python-based API Gateway for Nanopore Tracking App Microservices",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3007").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user"""
    token = credentials.credentials
    payload = auth_manager.verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload

# Health check endpoints
@app.get("/health")
async def health_check():
    """Gateway health check"""
    return {
        "service": "python-api-gateway",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/health/services")
async def services_health():
    """All services health check"""
    await service_registry.perform_health_checks()
    return service_registry.get_service_status()

# Metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus-style metrics"""
    status = service_registry.get_service_status()
    healthy_count = status["healthy_services"]
    total_count = status["total_services"]
    
    metrics_text = f"""
# HELP gateway_services_total Total number of services
# TYPE gateway_services_total gauge
gateway_services_total {total_count}

# HELP gateway_services_healthy Number of healthy services
# TYPE gateway_services_healthy gauge
gateway_services_healthy {healthy_count}

# HELP gateway_uptime_seconds Gateway uptime in seconds
# TYPE gateway_uptime_seconds counter
gateway_uptime_seconds {time.time()}
""".strip()
    
    return Response(content=metrics_text, media_type="text/plain")

# Service routing
service_routes = {
    "/api/samples": "sample-management",
    "/api/ai": "ai-processing",
    "/api/auth": "authentication",
    "/api/files": "file-storage",
    "/api/audit": "audit",
    "/api/submission": "submission"
}

@app.api_route("/api/{service_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_service(
    request: Request,
    service_path: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Proxy requests to appropriate microservices"""
    # Determine target service
    service_name = None
    clean_path = f"/{service_path}"
    
    for route, service in service_routes.items():
        if clean_path.startswith(route.replace("/api", "")):
            service_name = service
            clean_path = clean_path.replace(route.replace("/api", ""), "")
            break
    
    if not service_name:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get request body
    body = await request.body()
    
    # Prepare headers
    headers = dict(request.headers)
    headers["x-user-id"] = str(current_user.get("sub", current_user.get("id")))
    headers["x-user-role"] = current_user.get("role", "user")
    
    # Proxy the request
    response = await request_proxy.proxy_request(
        method=request.method,
        service_name=service_name,
        path=clean_path or "/",
        headers=headers,
        body=body,
        params=dict(request.query_params)
    )
    
    # Return response
    return StreamingResponse(
        iter([response.content]),
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.headers.get("content-type")
    )

# Public endpoints (no auth required)
@app.get("/api/public/health")
async def public_health():
    """Public health endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        log_level="info"
    ) 