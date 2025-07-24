"""
Sample Management Service - Python FastAPI
Core sample operations, status management, and workflow tracking
"""

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, selectinload
from sqlalchemy import String, DateTime, Integer, Float, Boolean, Text, select, update, delete
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import os
import logging
import asyncio
from contextlib import asynccontextmanager
import uvicorn

# Import the new models
from app.models import (
    Base, NanoporeSubmission, NanoporeSample, NanoporeProcessingStep,
    NanoporeSampleDetail, NanoporeAttachment,
    SubmissionStatus, SampleStatus, QCStatus, Priority, SampleType,
    SequencingPlatform, DataDeliveryMethod
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/sample_db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Database models
class Base(DeclarativeBase):
    pass

class SampleStatus(str, Enum):
    SUBMITTED = "submitted"
    PREP = "prep"
    SEQUENCING = "sequencing"
    ANALYSIS = "analysis"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class SamplePriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class NanoporeSample(Base):
    __tablename__ = "nanopore_samples"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sample_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_id: Mapped[Optional[str]] = mapped_column(String(100))
    submitter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    submitter_email: Mapped[str] = mapped_column(String(255), nullable=False)
    lab_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Sample details
    sample_type: Mapped[str] = mapped_column(String(50), nullable=False)
    sample_buffer: Mapped[Optional[str]] = mapped_column(String(100))
    concentration: Mapped[Optional[float]] = mapped_column(Float)
    volume: Mapped[Optional[float]] = mapped_column(Float)
    total_amount: Mapped[Optional[float]] = mapped_column(Float)
    
    # Flow cell selection
    flow_cell_type: Mapped[Optional[str]] = mapped_column(String(50))
    flow_cell_count: Mapped[int] = mapped_column(Integer, default=1)
    
    # Processing status
    status: Mapped[str] = mapped_column(String(20), default=SampleStatus.SUBMITTED.value)
    priority: Mapped[str] = mapped_column(String(10), default=SamplePriority.NORMAL.value)
    
    # Assignment and tracking
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255))
    library_prep_by: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Timestamps
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # User tracking
    created_by: Mapped[str] = mapped_column(String, nullable=False)

class ProcessingStep(Base):
    __tablename__ = "nanopore_processing_steps"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sample_id: Mapped[str] = mapped_column(String, nullable=False)
    step_name: Mapped[str] = mapped_column(String(100), nullable=False)
    step_status: Mapped[str] = mapped_column(String(20), default="pending")
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    estimated_duration_hours: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    results_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Pydantic models
class SampleBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    sample_name: str = Field(..., description="Sample name")
    project_id: Optional[str] = Field(None, description="Project ID")
    submitter_name: str = Field(..., description="Submitter name")
    submitter_email: str = Field(..., description="Submitter email")
    lab_name: Optional[str] = Field(None, description="Lab name")
    sample_type: str = Field(..., description="Sample type (DNA, RNA, etc.)")
    sample_buffer: Optional[str] = Field(None, description="Buffer type")
    concentration: Optional[float] = Field(None, description="Concentration (ng/μL)")
    volume: Optional[float] = Field(None, description="Volume (μL)")
    total_amount: Optional[float] = Field(None, description="Total amount (ng)")
    flow_cell_type: Optional[str] = Field(None, description="Flow cell type")
    flow_cell_count: int = Field(1, description="Flow cell count")
    priority: SamplePriority = Field(SamplePriority.NORMAL, description="Priority level")

class SampleCreate(SampleBase):
    pass

class SampleUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    sample_name: Optional[str] = None
    project_id: Optional[str] = None
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None
    lab_name: Optional[str] = None
    sample_type: Optional[str] = None
    sample_buffer: Optional[str] = None
    concentration: Optional[float] = None
    volume: Optional[float] = None
    total_amount: Optional[float] = None
    flow_cell_type: Optional[str] = None
    flow_cell_count: Optional[int] = None
    status: Optional[SampleStatus] = None
    priority: Optional[SamplePriority] = None
    assigned_to: Optional[str] = None
    library_prep_by: Optional[str] = None

class SampleResponse(SampleBase):
    id: str
    status: SampleStatus
    assigned_to: Optional[str]
    library_prep_by: Optional[str]
    submitted_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    created_by: str

class ProcessingStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    sample_id: str
    step_name: str
    step_status: str
    assigned_to: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    estimated_duration_hours: Optional[int]
    notes: Optional[str]
    results_data: Optional[str]
    created_at: datetime
    updated_at: datetime

# Database dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Sample service
class SampleService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_sample(self, sample_data: SampleCreate, created_by: str) -> SampleResponse:
        """Create a new sample"""
        import uuid
        
        sample_id = str(uuid.uuid4())
        
        db_sample = NanoporeSample(
            id=sample_id,
            created_by=created_by,
            **sample_data.model_dump()
        )
        
        self.db.add(db_sample)
        await self.db.commit()
        await self.db.refresh(db_sample)
        
        logger.info(f"Created sample {sample_id} by user {created_by}")
        return SampleResponse.model_validate(db_sample)
    
    async def get_sample(self, sample_id: str) -> Optional[SampleResponse]:
        """Get a sample by ID"""
        result = await self.db.execute(
            select(NanoporeSample).where(NanoporeSample.id == sample_id)
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            return SampleResponse.model_validate(sample)
        return None
    
    async def get_samples(
        self, 
        skip: int = 0, 
        limit: int = 100,
        status: Optional[SampleStatus] = None,
        priority: Optional[SamplePriority] = None,
        assigned_to: Optional[str] = None
    ) -> List[SampleResponse]:
        """Get samples with optional filters"""
        query = select(NanoporeSample)
        
        if status:
            query = query.where(NanoporeSample.status == status.value)
        if priority:
            query = query.where(NanoporeSample.priority == priority.value)
        if assigned_to:
            query = query.where(NanoporeSample.assigned_to == assigned_to)
        
        query = query.offset(skip).limit(limit).order_by(NanoporeSample.created_at.desc())
        
        result = await self.db.execute(query)
        samples = result.scalars().all()
        
        return [SampleResponse.model_validate(sample) for sample in samples]
    
    async def update_sample(self, sample_id: str, sample_data: SampleUpdate) -> Optional[SampleResponse]:
        """Update a sample"""
        # Get existing sample
        result = await self.db.execute(
            select(NanoporeSample).where(NanoporeSample.id == sample_id)
        )
        sample = result.scalar_one_or_none()
        
        if not sample:
            return None
        
        # Update fields
        update_data = sample_data.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            
            await self.db.execute(
                update(NanoporeSample)
                .where(NanoporeSample.id == sample_id)
                .values(**update_data)
            )
            await self.db.commit()
            
            # Refresh sample
            await self.db.refresh(sample)
        
        logger.info(f"Updated sample {sample_id}")
        return SampleResponse.model_validate(sample)
    
    async def delete_sample(self, sample_id: str) -> bool:
        """Delete a sample"""
        result = await self.db.execute(
            delete(NanoporeSample).where(NanoporeSample.id == sample_id)
        )
        
        if result.rowcount > 0:
            await self.db.commit()
            logger.info(f"Deleted sample {sample_id}")
            return True
        return False
    
    async def get_processing_steps(self, sample_id: str) -> List[ProcessingStepResponse]:
        """Get processing steps for a sample"""
        result = await self.db.execute(
            select(ProcessingStep)
            .where(ProcessingStep.sample_id == sample_id)
            .order_by(ProcessingStep.created_at)
        )
        steps = result.scalars().all()
        
        return [ProcessingStepResponse.model_validate(step) for step in steps]

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Sample Management Service...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Sample Management Service started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down Sample Management Service...")
    await engine.dispose()
    logger.info("Sample Management Service shutdown complete")

# FastAPI app
app = FastAPI(
    title="Sample Management Service",
    description="Python-based Sample Management for Nanopore Tracking",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
def get_cors_origins():
    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
    return [origin.strip() for origin in origins.split(",")]

def get_cors_methods():
    methods = os.getenv("CORS_METHODS", "GET,POST,PUT,DELETE,OPTIONS,PATCH")
    return [method.strip() for method in methods.split(",")]

def get_cors_headers():
    headers = os.getenv("CORS_HEADERS", "Content-Type,Authorization,X-Requested-With,Accept,Origin")
    return [header.strip() for header in headers.split(",")]

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=os.getenv("CORS_CREDENTIALS", "true").lower() == "true",
    allow_methods=get_cors_methods(),
    allow_headers=get_cors_headers(),
    max_age=int(os.getenv("CORS_MAX_AGE", "86400")),
)

# User dependency (from gateway headers)
def get_current_user(
    user_id: str = Depends(lambda request: request.headers.get("x-user-id")),
    user_role: str = Depends(lambda request: request.headers.get("x-user-role", "user"))
):
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not provided")
    return {"id": user_id, "role": user_role}

# Health check
@app.get("/health")
async def health_check():
    """Service health check"""
    return {
        "service": "sample-management",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

# Sample endpoints
@app.post("/samples", response_model=SampleResponse)
async def create_sample(
    sample: SampleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new sample"""
    service = SampleService(db)
    return await service.create_sample(sample, current_user["id"])

@app.get("/samples/{sample_id}", response_model=SampleResponse)
async def get_sample(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a sample by ID"""
    service = SampleService(db)
    sample = await service.get_sample(sample_id)
    
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    return sample

@app.get("/samples", response_model=List[SampleResponse])
async def get_samples(
    skip: int = 0,
    limit: int = 100,
    status: Optional[SampleStatus] = None,
    priority: Optional[SamplePriority] = None,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get samples with optional filters"""
    service = SampleService(db)
    return await service.get_samples(skip, limit, status, priority, assigned_to)

@app.put("/samples/{sample_id}", response_model=SampleResponse)
async def update_sample(
    sample_id: str,
    sample_update: SampleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update a sample"""
    service = SampleService(db)
    sample = await service.update_sample(sample_id, sample_update)
    
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    return sample

@app.delete("/samples/{sample_id}")
async def delete_sample(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a sample"""
    service = SampleService(db)
    deleted = await service.delete_sample(sample_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    return {"message": "Sample deleted successfully"}

@app.get("/samples/{sample_id}/steps", response_model=List[ProcessingStepResponse])
async def get_processing_steps(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get processing steps for a sample"""
    service = SampleService(db)
    return await service.get_processing_steps(sample_id)

# Statistics endpoint
@app.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get sample statistics"""
    # Count samples by status
    status_counts = {}
    for status in SampleStatus:
        result = await db.execute(
            select(NanoporeSample).where(NanoporeSample.status == status.value)
        )
        status_counts[status.value] = len(result.scalars().all())
    
    # Count samples by priority
    priority_counts = {}
    for priority in SamplePriority:
        result = await db.execute(
            select(NanoporeSample).where(NanoporeSample.priority == priority.value)
        )
        priority_counts[priority.value] = len(result.scalars().all())
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "status_counts": status_counts,
        "priority_counts": priority_counts
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8001")),
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        log_level="info"
    ) 