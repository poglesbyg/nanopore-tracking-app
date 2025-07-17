"""API routes for the submission service."""
import psutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from app.models.schemas import ProcessingResult, HealthResponse
from app.services.pdf_processor import PDFProcessor
from app.services.csv_processor import CSVProcessor
from app.core.config import settings


router = APIRouter(prefix=settings.api_prefix)

# Initialize processors
pdf_processor = PDFProcessor()
csv_processor = CSVProcessor()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    memory = psutil.virtual_memory()
    cpu = psutil.cpu_percent(interval=0.1)
    
    return HealthResponse(
        environment=settings.environment,
        memory_usage_mb=memory.used / 1024 / 1024,
        cpu_percent=cpu
    )


@router.post("/process-pdf", response_model=ProcessingResult)
async def process_pdf(file: UploadFile = File(...)):
    """Process a PDF file and extract sample data."""
    if file.content_type != "application/pdf":
        raise HTTPException(400, "File must be a PDF")
    
    if file.size > settings.max_file_size:
        raise HTTPException(413, f"File too large. Maximum size: {settings.max_file_size} bytes")
    
    content = await file.read()
    result = await pdf_processor.process_file(content, file.filename)
    
    return result


@router.post("/process-csv", response_model=ProcessingResult)
async def process_csv(file: UploadFile = File(...)):
    """Process a CSV file and extract sample data."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "File must be a CSV")
    
    if file.size > settings.max_file_size:
        raise HTTPException(413, f"File too large. Maximum size: {settings.max_file_size} bytes")
    
    content = await file.read()
    result = await csv_processor.process_file(content, file.filename)
    
    return result


@router.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Nanopore Submission Service",
        "version": "1.0.0",
        "endpoints": {
            "health": f"{settings.api_prefix}/health",
            "process_pdf": f"{settings.api_prefix}/process-pdf",
            "process_csv": f"{settings.api_prefix}/process-csv"
        }
    } 