"""
AI Processing Service - Python FastAPI
PDF processing, LLM integration, and RAG system for nanopore sequencing
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Integer, Text, Boolean, select, update
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import os
import logging
import asyncio
import aiofiles
import json
import httpx
from contextlib import asynccontextmanager
import uvicorn
import tempfile
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/ai_db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# External service URLs
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
VECTOR_DB_URL = os.getenv("VECTOR_DB_URL", "http://vector-db:6333")

# Database models
class Base(DeclarativeBase):
    pass

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf_extract, llm_process, rag_enhance
    status: Mapped[str] = mapped_column(String(20), default=ProcessingStatus.PENDING.value)
    
    # Input data
    input_file_path: Mapped[Optional[str]] = mapped_column(String(500))
    input_text: Mapped[Optional[str]] = mapped_column(Text)
    input_params: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    
    # Output data
    output_data: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    confidence_score: Mapped[Optional[float]] = mapped_column()
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    job_id: Mapped[str] = mapped_column(String, nullable=False)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_value: Mapped[Optional[str]] = mapped_column(Text)
    confidence: Mapped[Optional[float]] = mapped_column()
    extraction_method: Mapped[str] = mapped_column(String(50))  # llm, pattern, rag
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Pydantic models
class ProcessingJobCreate(BaseModel):
    job_type: str = Field(..., description="Type of processing job")
    input_params: Optional[Dict[str, Any]] = Field(None, description="Processing parameters")

class ProcessingJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    user_id: str
    job_type: str
    status: ProcessingStatus
    input_file_path: Optional[str]
    input_text: Optional[str]
    input_params: Optional[str]
    output_data: Optional[str]
    confidence_score: Optional[float]
    processing_time_ms: Optional[int]
    error_message: Optional[str]
    retry_count: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    updated_at: datetime

class PDFExtractionResult(BaseModel):
    success: bool
    extracted_text: Optional[str] = None
    extracted_fields: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None

class LLMProcessingResult(BaseModel):
    success: bool
    processed_data: Optional[Dict[str, Any]] = None
    confidence_score: Optional[float] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None

# Database dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# AI Processing Service
class AIProcessingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ollama_client = httpx.AsyncClient(base_url=OLLAMA_HOST, timeout=60.0)
        self.temp_dir = Path(tempfile.gettempdir()) / "ai_processing"
        self.temp_dir.mkdir(exist_ok=True)
    
    async def create_job(self, job_data: ProcessingJobCreate, user_id: str) -> ProcessingJobResponse:
        """Create a new processing job"""
        import uuid
        
        job_id = str(uuid.uuid4())
        
        db_job = ProcessingJob(
            id=job_id,
            user_id=user_id,
            job_type=job_data.job_type,
            input_params=json.dumps(job_data.input_params) if job_data.input_params else None
        )
        
        self.db.add(db_job)
        await self.db.commit()
        await self.db.refresh(db_job)
        
        logger.info(f"Created processing job {job_id} for user {user_id}")
        return ProcessingJobResponse.model_validate(db_job)
    
    async def get_job(self, job_id: str) -> Optional[ProcessingJobResponse]:
        """Get a processing job by ID"""
        result = await self.db.execute(
            select(ProcessingJob).where(ProcessingJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        
        if job:
            return ProcessingJobResponse.model_validate(job)
        return None
    
    async def update_job_status(self, job_id: str, status: ProcessingStatus, **kwargs) -> bool:
        """Update job status and other fields"""
        update_data = {"status": status.value, "updated_at": datetime.utcnow()}
        
        if status == ProcessingStatus.PROCESSING:
            update_data["started_at"] = datetime.utcnow()
        elif status in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]:
            update_data["completed_at"] = datetime.utcnow()
        
        # Add any additional fields
        update_data.update(kwargs)
        
        result = await self.db.execute(
            update(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .values(**update_data)
        )
        
        if result.rowcount > 0:
            await self.db.commit()
            return True
        return False
    
    async def process_pdf(self, file: UploadFile, job_id: str) -> PDFExtractionResult:
        """Process PDF file and extract text/fields"""
        start_time = datetime.utcnow()
        
        try:
            # Save uploaded file temporarily
            temp_file = self.temp_dir / f"{job_id}_{file.filename}"
            
            async with aiofiles.open(temp_file, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            # Update job status
            await self.update_job_status(
                job_id, 
                ProcessingStatus.PROCESSING,
                input_file_path=str(temp_file)
            )
            
            # Extract text (placeholder - you can integrate with your existing PDF processing)
            extracted_text = await self._extract_pdf_text(temp_file)
            
            # Extract fields using LLM
            extracted_fields = await self._extract_fields_with_llm(extracted_text)
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence(extracted_fields)
            
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            # Update job with results
            await self.update_job_status(
                job_id,
                ProcessingStatus.COMPLETED,
                output_data=json.dumps({
                    "extracted_text": extracted_text,
                    "extracted_fields": extracted_fields
                }),
                confidence_score=confidence_score,
                processing_time_ms=processing_time
            )
            
            # Clean up temp file
            if temp_file.exists():
                temp_file.unlink()
            
            return PDFExtractionResult(
                success=True,
                extracted_text=extracted_text,
                extracted_fields=extracted_fields,
                confidence_score=confidence_score,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"PDF processing failed for job {job_id}: {e}")
            
            await self.update_job_status(
                job_id,
                ProcessingStatus.FAILED,
                error_message=str(e)
            )
            
            return PDFExtractionResult(
                success=False,
                error_message=str(e)
            )
    
    async def _extract_pdf_text(self, file_path: Path) -> str:
        """Extract text from PDF file"""
        try:
            # Placeholder for PDF text extraction
            # You can integrate with your existing PDF processing logic here
            import PyPDF2
            
            async with aiofiles.open(file_path, 'rb') as file:
                pdf_content = await file.read()
                
            # Use PyPDF2 or your preferred PDF library
            # This is a simplified example
            text = "Sample extracted text from PDF"
            
            return text
            
        except Exception as e:
            logger.error(f"PDF text extraction failed: {e}")
            return ""
    
    async def _extract_fields_with_llm(self, text: str) -> Dict[str, Any]:
        """Extract structured fields from text using LLM"""
        try:
            # Check if Ollama is available
            health_response = await self.ollama_client.get("/api/tags")
            if health_response.status_code != 200:
                logger.warning("Ollama not available, using pattern matching")
                return await self._extract_fields_pattern_matching(text)
            
            # LLM prompt for nanopore sequencing form extraction
            prompt = f"""
            Extract the following fields from this nanopore sequencing form text:
            
            Text: {text}
            
            Extract these fields if present:
            - sample_name
            - submitter_name
            - submitter_email
            - lab_name
            - sample_type
            - concentration
            - volume
            - flow_cell_type
            - priority
            
            Return as JSON format with null for missing fields.
            """
            
            # Call Ollama API
            response = await self.ollama_client.post("/api/generate", json={
                "model": "llama2",  # or your preferred model
                "prompt": prompt,
                "stream": False
            })
            
            if response.status_code == 200:
                result = response.json()
                # Parse the LLM response and extract structured data
                extracted_fields = self._parse_llm_response(result.get("response", ""))
                return extracted_fields
            else:
                logger.warning("LLM processing failed, using pattern matching")
                return await self._extract_fields_pattern_matching(text)
                
        except Exception as e:
            logger.error(f"LLM field extraction failed: {e}")
            return await self._extract_fields_pattern_matching(text)
    
    async def _extract_fields_pattern_matching(self, text: str) -> Dict[str, Any]:
        """Fallback pattern matching for field extraction"""
        import re
        
        fields = {}
        
        # Pattern matching for common fields
        patterns = {
            "sample_name": r"sample\s*name[:\s]+([^\n\r]+)",
            "submitter_name": r"submitter[:\s]+([^\n\r]+)",
            "submitter_email": r"email[:\s]+([^\s@]+@[^\s@]+\.[^\s@]+)",
            "concentration": r"concentration[:\s]+([0-9.]+)",
            "volume": r"volume[:\s]+([0-9.]+)",
        }
        
        for field, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields[field] = match.group(1).strip()
            else:
                fields[field] = None
        
        return fields
    
    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response and extract structured data"""
        try:
            # Try to parse as JSON
            import json
            return json.loads(response)
        except:
            # Fallback to basic parsing
            return {"raw_response": response}
    
    def _calculate_confidence(self, extracted_fields: Dict[str, Any]) -> float:
        """Calculate confidence score based on extracted fields"""
        if not extracted_fields:
            return 0.0
        
        # Count non-null fields
        non_null_fields = sum(1 for value in extracted_fields.values() if value is not None)
        total_fields = len(extracted_fields)
        
        if total_fields == 0:
            return 0.0
        
        # Basic confidence calculation
        confidence = (non_null_fields / total_fields) * 100
        return min(confidence, 100.0)
    
    async def process_with_rag(self, text: str, job_id: str) -> LLMProcessingResult:
        """Process text with RAG enhancement"""
        start_time = datetime.utcnow()
        
        try:
            await self.update_job_status(job_id, ProcessingStatus.PROCESSING)
            
            # RAG processing (placeholder)
            # You can integrate with your existing RAG system here
            processed_data = {
                "enhanced_text": text,
                "rag_insights": ["Sample processing insight 1", "Sample processing insight 2"],
                "recommendations": ["Recommendation 1", "Recommendation 2"]
            }
            
            confidence_score = 85.0  # Placeholder
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            await self.update_job_status(
                job_id,
                ProcessingStatus.COMPLETED,
                output_data=json.dumps(processed_data),
                confidence_score=confidence_score,
                processing_time_ms=processing_time
            )
            
            return LLMProcessingResult(
                success=True,
                processed_data=processed_data,
                confidence_score=confidence_score,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"RAG processing failed for job {job_id}: {e}")
            
            await self.update_job_status(
                job_id,
                ProcessingStatus.FAILED,
                error_message=str(e)
            )
            
            return LLMProcessingResult(
                success=False,
                error_message=str(e)
            )

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting AI Processing Service...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("AI Processing Service started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down AI Processing Service...")
    await engine.dispose()
    logger.info("AI Processing Service shutdown complete")

# FastAPI app
app = FastAPI(
    title="AI Processing Service",
    description="Python-based AI Processing for PDF and LLM operations",
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

# Health check
@app.get("/health")
async def health_check():
    """Service health check"""
    return {
        "service": "ai-processing",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "ollama_host": OLLAMA_HOST,
        "vector_db_url": VECTOR_DB_URL
    }

# Processing endpoints
@app.post("/jobs", response_model=ProcessingJobResponse)
async def create_processing_job(
    job: ProcessingJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Create a new processing job"""
    service = AIProcessingService(db)
    return await service.create_job(job, current_user["id"])

@app.get("/jobs/{job_id}", response_model=ProcessingJobResponse)
async def get_processing_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get processing job status"""
    service = AIProcessingService(db)
    job = await service.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job

@app.post("/process-pdf", response_model=PDFExtractionResult)
async def process_pdf(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Process PDF file and extract structured data"""
    # Create processing job
    service = AIProcessingService(db)
    job = await service.create_job(
        ProcessingJobCreate(job_type="pdf_extract"),
        current_user["id"]
    )
    
    # Process PDF
    result = await service.process_pdf(file, job.id)
    
    return result

@app.post("/process-text", response_model=LLMProcessingResult)
async def process_text_with_llm(
    text: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Process text with LLM and RAG enhancement"""
    # Create processing job
    service = AIProcessingService(db)
    job = await service.create_job(
        ProcessingJobCreate(job_type="llm_process"),
        current_user["id"]
    )
    
    # Process with RAG
    result = await service.process_with_rag(text, job.id)
    
    return result

# System status endpoint
@app.get("/status")
async def get_system_status(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get AI processing system status"""
    try:
        # Check Ollama availability
        async with httpx.AsyncClient() as client:
            ollama_response = await client.get(f"{OLLAMA_HOST}/api/tags", timeout=5.0)
            ollama_status = ollama_response.status_code == 200
    except:
        ollama_status = False
    
    try:
        # Check Vector DB availability
        async with httpx.AsyncClient() as client:
            vector_response = await client.get(f"{VECTOR_DB_URL}/health", timeout=5.0)
            vector_status = vector_response.status_code == 200
    except:
        vector_status = False
    
    # Get job statistics
    pending_jobs = await db.execute(
        select(ProcessingJob).where(ProcessingJob.status == ProcessingStatus.PENDING.value)
    )
    processing_jobs = await db.execute(
        select(ProcessingJob).where(ProcessingJob.status == ProcessingStatus.PROCESSING.value)
    )
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "ollama_available": ollama_status,
        "vector_db_available": vector_status,
        "pending_jobs": len(pending_jobs.scalars().all()),
        "processing_jobs": len(processing_jobs.scalars().all()),
        "system_healthy": ollama_status and vector_status
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8002")),
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        log_level="info"
    ) 