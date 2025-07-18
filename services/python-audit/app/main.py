"""
Audit Service - Python FastAPI
Activity logging, compliance tracking, and audit trail management
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Text, select, func, and_
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import os
import logging
from contextlib import asynccontextmanager
import uvicorn
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/audit_db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Database models
class Base(DeclarativeBase):
    pass

class AuditLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    
    # Event identification
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    service_name: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[str] = mapped_column(String(20), default=AuditLevel.INFO.value)
    
    # User context
    user_id: Mapped[Optional[str]] = mapped_column(String)
    user_role: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Request context
    resource_id: Mapped[Optional[str]] = mapped_column(String)
    resource_type: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Event details
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    
    # Network context
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Outcome
    success: Mapped[bool] = mapped_column(default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Pydantic models
class AuditEventCreate(BaseModel):
    event_type: str = Field(..., description="Type of event")
    service_name: str = Field(..., description="Service that generated the event")
    action: str = Field(..., description="Action performed")
    level: AuditLevel = Field(AuditLevel.INFO, description="Event severity level")
    user_id: Optional[str] = Field(None, description="User ID")
    user_role: Optional[str] = Field(None, description="User role")
    resource_id: Optional[str] = Field(None, description="Resource ID")
    resource_type: Optional[str] = Field(None, description="Resource type")
    description: str = Field(..., description="Event description")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional event details")
    ip_address: Optional[str] = Field(None, description="Client IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    success: bool = Field(True, description="Whether the action was successful")
    error_message: Optional[str] = Field(None, description="Error message if applicable")

class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    event_type: str
    service_name: str
    action: str
    level: AuditLevel
    user_id: Optional[str]
    user_role: Optional[str]
    resource_id: Optional[str]
    resource_type: Optional[str]
    description: str
    details: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    success: bool
    error_message: Optional[str]
    created_at: datetime

class AuditEventListResponse(BaseModel):
    events: List[AuditEventResponse]
    total: int
    page: int
    per_page: int

class AuditStatsResponse(BaseModel):
    total_events: int
    events_by_level: Dict[str, int]
    events_by_service: Dict[str, int]
    events_by_action: Dict[str, int]
    success_rate: float
    time_range: str

# Database dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Audit Service
class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_event(self, event_data: AuditEventCreate) -> AuditEventResponse:
        """Create a new audit event"""
        event_id = str(uuid.uuid4())
        
        # Convert details to JSON string if provided
        details_json = None
        if event_data.details:
            import json
            details_json = json.dumps(event_data.details)
        
        db_event = AuditEvent(
            id=event_id,
            event_type=event_data.event_type,
            service_name=event_data.service_name,
            action=event_data.action,
            level=event_data.level.value,
            user_id=event_data.user_id,
            user_role=event_data.user_role,
            resource_id=event_data.resource_id,
            resource_type=event_data.resource_type,
            description=event_data.description,
            details=details_json,
            ip_address=event_data.ip_address,
            user_agent=event_data.user_agent,
            success=event_data.success,
            error_message=event_data.error_message
        )
        
        self.db.add(db_event)
        await self.db.commit()
        await self.db.refresh(db_event)
        
        logger.info(f"Created audit event {event_id}: {event_data.action} by {event_data.user_id}")
        return AuditEventResponse.model_validate(db_event)
    
    async def get_events(
        self,
        page: int = 1,
        per_page: int = 50,
        service_name: Optional[str] = None,
        user_id: Optional[str] = None,
        event_type: Optional[str] = None,
        level: Optional[AuditLevel] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> AuditEventListResponse:
        """Get audit events with filtering and pagination"""
        offset = (page - 1) * per_page
        
        # Build query
        query = select(AuditEvent)
        count_query = select(func.count(AuditEvent.id))
        
        # Apply filters
        conditions = []
        
        if service_name:
            conditions.append(AuditEvent.service_name == service_name)
        
        if user_id:
            conditions.append(AuditEvent.user_id == user_id)
        
        if event_type:
            conditions.append(AuditEvent.event_type == event_type)
        
        if level:
            conditions.append(AuditEvent.level == level.value)
        
        if start_date:
            conditions.append(AuditEvent.created_at >= start_date)
        
        if end_date:
            conditions.append(AuditEvent.created_at <= end_date)
        
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # Apply ordering and pagination
        query = query.order_by(AuditEvent.created_at.desc()).offset(offset).limit(per_page)
        
        # Execute queries
        events_result = await self.db.execute(query)
        events = events_result.scalars().all()
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        return AuditEventListResponse(
            events=[AuditEventResponse.model_validate(event) for event in events],
            total=total,
            page=page,
            per_page=per_page
        )
    
    async def get_event_by_id(self, event_id: str) -> Optional[AuditEventResponse]:
        """Get a specific audit event by ID"""
        result = await self.db.execute(
            select(AuditEvent).where(AuditEvent.id == event_id)
        )
        
        event = result.scalar_one_or_none()
        
        if event:
            return AuditEventResponse.model_validate(event)
        return None
    
    async def get_audit_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> AuditStatsResponse:
        """Get audit statistics"""
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
        # Base query with date filter
        base_query = select(AuditEvent).where(
            and_(
                AuditEvent.created_at >= start_date,
                AuditEvent.created_at <= end_date
            )
        )
        
        # Total events
        total_result = await self.db.execute(
            select(func.count(AuditEvent.id)).where(
                and_(
                    AuditEvent.created_at >= start_date,
                    AuditEvent.created_at <= end_date
                )
            )
        )
        total_events = total_result.scalar()
        
        # Events by level
        level_result = await self.db.execute(
            select(AuditEvent.level, func.count(AuditEvent.id))
            .where(
                and_(
                    AuditEvent.created_at >= start_date,
                    AuditEvent.created_at <= end_date
                )
            )
            .group_by(AuditEvent.level)
        )
        events_by_level = {level: count for level, count in level_result.fetchall()}
        
        # Events by service
        service_result = await self.db.execute(
            select(AuditEvent.service_name, func.count(AuditEvent.id))
            .where(
                and_(
                    AuditEvent.created_at >= start_date,
                    AuditEvent.created_at <= end_date
                )
            )
            .group_by(AuditEvent.service_name)
        )
        events_by_service = {service: count for service, count in service_result.fetchall()}
        
        # Events by action
        action_result = await self.db.execute(
            select(AuditEvent.action, func.count(AuditEvent.id))
            .where(
                and_(
                    AuditEvent.created_at >= start_date,
                    AuditEvent.created_at <= end_date
                )
            )
            .group_by(AuditEvent.action)
        )
        events_by_action = {action: count for action, count in action_result.fetchall()}
        
        # Success rate
        success_result = await self.db.execute(
            select(func.count(AuditEvent.id))
            .where(
                and_(
                    AuditEvent.created_at >= start_date,
                    AuditEvent.created_at <= end_date,
                    AuditEvent.success == True
                )
            )
        )
        success_count = success_result.scalar()
        success_rate = (success_count / total_events * 100) if total_events > 0 else 0
        
        return AuditStatsResponse(
            total_events=total_events,
            events_by_level=events_by_level,
            events_by_service=events_by_service,
            events_by_action=events_by_action,
            success_rate=success_rate,
            time_range=f"{start_date.isoformat()} to {end_date.isoformat()}"
        )
    
    async def cleanup_old_events(self, days_to_keep: int = 90) -> int:
        """Clean up old audit events"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Count events to be deleted
        count_result = await self.db.execute(
            select(func.count(AuditEvent.id))
            .where(AuditEvent.created_at < cutoff_date)
        )
        count_to_delete = count_result.scalar()
        
        # Delete old events
        from sqlalchemy import delete
        await self.db.execute(
            delete(AuditEvent).where(AuditEvent.created_at < cutoff_date)
        )
        await self.db.commit()
        
        logger.info(f"Cleaned up {count_to_delete} audit events older than {days_to_keep} days")
        return count_to_delete

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Audit Service...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Audit Service started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down Audit Service...")
    await engine.dispose()
    logger.info("Audit Service shutdown complete")

# FastAPI app
app = FastAPI(
    title="Audit Service",
    description="Python-based Audit and Compliance Tracking",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# User dependency (from gateway headers)
def get_current_user(
    user_id: str = Depends(lambda request: request.headers.get("x-user-id")),
    user_role: str = Depends(lambda request: request.headers.get("x-user-role", "user"))
):
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")
    return {"id": user_id, "role": user_role}

# Admin user dependency
def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Health check
@app.get("/health")
async def health_check():
    """Service health check"""
    return {
        "service": "audit",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

# Audit endpoints
@app.post("/events", response_model=AuditEventResponse)
async def create_audit_event(
    event: AuditEventCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new audit event"""
    audit_service = AuditService(db)
    return await audit_service.create_event(event)

@app.get("/events", response_model=AuditEventListResponse)
async def get_audit_events(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=1000, description="Items per page"),
    service_name: Optional[str] = Query(None, description="Filter by service name"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    level: Optional[AuditLevel] = Query(None, description="Filter by event level"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get audit events with filtering"""
    audit_service = AuditService(db)
    
    # Non-admin users can only see their own events
    if current_user["role"] != "admin":
        user_id = current_user["id"]
    
    return await audit_service.get_events(
        page=page,
        per_page=per_page,
        service_name=service_name,
        user_id=user_id,
        event_type=event_type,
        level=level,
        start_date=start_date,
        end_date=end_date
    )

@app.get("/events/{event_id}", response_model=AuditEventResponse)
async def get_audit_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a specific audit event"""
    audit_service = AuditService(db)
    event = await audit_service.get_event_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Audit event not found")
    
    # Non-admin users can only see their own events
    if current_user["role"] != "admin" and event.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return event

@app.get("/stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    start_date: Optional[datetime] = Query(None, description="Start date for statistics"),
    end_date: Optional[datetime] = Query(None, description="End date for statistics"),
    db: AsyncSession = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """Get audit statistics (admin only)"""
    audit_service = AuditService(db)
    return await audit_service.get_audit_stats(start_date, end_date)

@app.delete("/cleanup")
async def cleanup_old_events(
    days_to_keep: int = Query(90, ge=1, le=365, description="Days to keep events"),
    db: AsyncSession = Depends(get_db),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """Clean up old audit events (admin only)"""
    audit_service = AuditService(db)
    deleted_count = await audit_service.cleanup_old_events(days_to_keep)
    
    return {
        "message": f"Cleaned up {deleted_count} old audit events",
        "deleted_count": deleted_count,
        "days_kept": days_to_keep
    }

# Convenience endpoints for common audit events
@app.post("/events/user-action")
async def log_user_action(
    action: str,
    description: str,
    resource_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Log a user action (convenience endpoint)"""
    audit_service = AuditService(db)
    
    event_data = AuditEventCreate(
        event_type="user_action",
        service_name="user_interface",
        action=action,
        level=AuditLevel.ERROR if not success else AuditLevel.INFO,
        user_id=current_user["id"],
        user_role=current_user["role"],
        resource_id=resource_id,
        resource_type=resource_type,
        description=description,
        success=success,
        error_message=error_message
    )
    
    return await audit_service.create_event(event_data)

@app.post("/events/system-event")
async def log_system_event(
    event_type: str,
    service_name: str,
    action: str,
    description: str,
    level: AuditLevel = AuditLevel.INFO,
    success: bool = True,
    error_message: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Log a system event (convenience endpoint)"""
    audit_service = AuditService(db)
    
    event_data = AuditEventCreate(
        event_type=event_type,
        service_name=service_name,
        action=action,
        level=level,
        description=description,
        success=success,
        error_message=error_message
    )
    
    return await audit_service.create_event(event_data)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8005")),
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        log_level="info"
    ) 