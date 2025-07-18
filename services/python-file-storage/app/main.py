"""
File Storage Service - Python FastAPI
Async file operations, storage management, and file metadata tracking
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Integer, Boolean, select, update
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, BinaryIO
from datetime import datetime
from enum import Enum
import os
import logging
import aiofiles
import aiofiles.os
from pathlib import Path
import hashlib
import mimetypes
from contextlib import asynccontextmanager
import uvicorn
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/files_db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

# Storage configuration
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "/tmp/file_storage"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

# Database models
class Base(DeclarativeBase):
    pass

class FileStatus(str, Enum):
    UPLOADING = "uploading"
    STORED = "stored"
    PROCESSING = "processing"
    ARCHIVED = "archived"
    DELETED = "deleted"

class StoredFile(Base):
    __tablename__ = "stored_files"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    
    # File metadata
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    status: Mapped[str] = mapped_column(String(20), default=FileStatus.STORED.value)
    
    # Access control
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    access_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed: Mapped[Optional[datetime]] = mapped_column(DateTime)

# Pydantic models
class FileUploadResponse(BaseModel):
    file_id: str
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    file_hash: str
    status: FileStatus
    created_at: datetime

class FileInfoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    user_id: str
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    file_hash: str
    status: FileStatus
    is_public: bool
    access_count: int
    created_at: datetime
    updated_at: datetime
    last_accessed: Optional[datetime]

class FileListResponse(BaseModel):
    files: List[FileInfoResponse]
    total: int
    page: int
    per_page: int

# Database dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# File Storage Service
class FileStorageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage_path = STORAGE_PATH
    
    async def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of file"""
        hash_sha256 = hashlib.sha256()
        async with aiofiles.open(file_path, 'rb') as f:
            while chunk := await f.read(8192):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    async def store_file(self, file: UploadFile, user_id: str) -> FileUploadResponse:
        """Store uploaded file and create database record"""
        file_id = str(uuid.uuid4())
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix if file.filename else ""
        stored_filename = f"{file_id}{file_extension}"
        file_path = self.storage_path / stored_filename
        
        # Create user directory if needed
        user_dir = self.storage_path / user_id
        user_dir.mkdir(exist_ok=True)
        file_path = user_dir / stored_filename
        
        try:
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            # Get file info
            file_size = await aiofiles.os.path.getsize(file_path)
            mime_type = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
            file_hash = await self.calculate_file_hash(file_path)
            
            # Create database record
            db_file = StoredFile(
                id=file_id,
                user_id=user_id,
                original_filename=file.filename or "unknown",
                stored_filename=stored_filename,
                file_path=str(file_path),
                file_size=file_size,
                mime_type=mime_type,
                file_hash=file_hash,
                status=FileStatus.STORED.value
            )
            
            self.db.add(db_file)
            await self.db.commit()
            await self.db.refresh(db_file)
            
            logger.info(f"Stored file {file.filename} as {stored_filename} for user {user_id}")
            
            return FileUploadResponse(
                file_id=file_id,
                original_filename=file.filename or "unknown",
                stored_filename=stored_filename,
                file_size=file_size,
                mime_type=mime_type,
                file_hash=file_hash,
                status=FileStatus.STORED,
                created_at=db_file.created_at
            )
            
        except Exception as e:
            # Clean up file if database operation fails
            if file_path.exists():
                await aiofiles.os.remove(file_path)
            logger.error(f"File storage failed: {e}")
            raise HTTPException(status_code=500, detail="File storage failed")
    
    async def get_file_info(self, file_id: str, user_id: str) -> Optional[FileInfoResponse]:
        """Get file information"""
        result = await self.db.execute(
            select(StoredFile).where(
                (StoredFile.id == file_id) & 
                ((StoredFile.user_id == user_id) | (StoredFile.is_public == True))
            )
        )
        
        file_record = result.scalar_one_or_none()
        
        if file_record:
            return FileInfoResponse.model_validate(file_record)
        return None
    
    async def get_user_files(self, user_id: str, page: int = 1, per_page: int = 20) -> FileListResponse:
        """Get user's files with pagination"""
        offset = (page - 1) * per_page
        
        # Get files
        files_result = await self.db.execute(
            select(StoredFile)
            .where(StoredFile.user_id == user_id)
            .offset(offset)
            .limit(per_page)
            .order_by(StoredFile.created_at.desc())
        )
        
        files = files_result.scalars().all()
        
        # Get total count
        count_result = await self.db.execute(
            select(StoredFile).where(StoredFile.user_id == user_id)
        )
        total = len(count_result.scalars().all())
        
        return FileListResponse(
            files=[FileInfoResponse.model_validate(f) for f in files],
            total=total,
            page=page,
            per_page=per_page
        )
    
    async def get_file_stream(self, file_id: str, user_id: str):
        """Get file stream for download"""
        file_info = await self.get_file_info(file_id, user_id)
        
        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path = Path(file_info.file_path)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Update access count
        await self.db.execute(
            update(StoredFile)
            .where(StoredFile.id == file_id)
            .values(
                access_count=StoredFile.access_count + 1,
                last_accessed=datetime.utcnow()
            )
        )
        await self.db.commit()
        
        return file_path, file_info.mime_type, file_info.original_filename
    
    async def delete_file(self, file_id: str, user_id: str) -> bool:
        """Delete file and database record"""
        result = await self.db.execute(
            select(StoredFile).where(
                (StoredFile.id == file_id) & (StoredFile.user_id == user_id)
            )
        )
        
        file_record = result.scalar_one_or_none()
        
        if not file_record:
            return False
        
        # Delete physical file
        file_path = Path(file_record.file_path)
        if file_path.exists():
            await aiofiles.os.remove(file_path)
        
        # Update database record
        await self.db.execute(
            update(StoredFile)
            .where(StoredFile.id == file_id)
            .values(status=FileStatus.DELETED.value)
        )
        await self.db.commit()
        
        logger.info(f"Deleted file {file_id} for user {user_id}")
        return True

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting File Storage Service...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Ensure storage directory exists
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    
    logger.info("File Storage Service started successfully")
    yield
    
    # Shutdown
    logger.info("Shutting down File Storage Service...")
    await engine.dispose()
    logger.info("File Storage Service shutdown complete")

# FastAPI app
app = FastAPI(
    title="File Storage Service",
    description="Python-based File Storage and Management",
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
        "service": "file-storage",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "storage_path": str(STORAGE_PATH)
    }

# File operations
@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Upload a file"""
    storage_service = FileStorageService(db)
    return await storage_service.store_file(file, current_user["id"])

@app.get("/files", response_model=FileListResponse)
async def get_files(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's files"""
    storage_service = FileStorageService(db)
    return await storage_service.get_user_files(current_user["id"], page, per_page)

@app.get("/files/{file_id}", response_model=FileInfoResponse)
async def get_file_info(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get file information"""
    storage_service = FileStorageService(db)
    file_info = await storage_service.get_file_info(file_id, current_user["id"])
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    return file_info

@app.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Download a file"""
    storage_service = FileStorageService(db)
    file_path, mime_type, original_filename = await storage_service.get_file_stream(
        file_id, current_user["id"]
    )
    
    return FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=original_filename
    )

@app.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a file"""
    storage_service = FileStorageService(db)
    success = await storage_service.delete_file(file_id, current_user["id"])
    
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {"message": "File deleted successfully"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8004")),
        reload=os.getenv("ENVIRONMENT", "production") == "development",
        log_level="info"
    ) 