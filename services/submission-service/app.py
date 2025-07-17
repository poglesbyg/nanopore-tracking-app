#!/usr/bin/env python3
"""
Nanopore Submission Service
Memory-efficient PDF and CSV processing microservice
"""

import os
import asyncio
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import tempfile
import shutil

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from pydantic import BaseModel, ValidationError
import pandas as pd
import pdfplumber
from celery import Celery
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Nanopore Submission Service",
    description="Memory-efficient PDF and CSV processing for nanopore samples",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Celery for background tasks
celery_app = Celery(
    'submission_service',
    broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0')
)

# Pydantic models for validation
class SampleData(BaseModel):
    sample_name: str
    project_id: Optional[str] = None
    submitter_name: str
    submitter_email: str
    lab_name: Optional[str] = None
    sample_type: str
    sample_buffer: Optional[str] = None
    concentration: Optional[float] = None
    volume: Optional[float] = None
    total_amount: Optional[float] = None
    flow_cell_type: Optional[str] = None
    flow_cell_count: Optional[int] = None
    priority: Optional[str] = "normal"
    assigned_to: Optional[str] = None
    library_prep_by: Optional[str] = None
    chart_field: str

class ProcessingResult(BaseModel):
    success: bool
    message: str
    samples_processed: int
    samples_created: int
    errors: List[str] = []
    processing_time: float

class HealthCheck(BaseModel):
    status: str
    memory_usage: Dict[str, Any]
    service: str

# Memory monitoring
import psutil
def get_memory_usage():
    """Get current memory usage statistics"""
    process = psutil.Process()
    memory_info = process.memory_info()
    return {
        "rss_mb": memory_info.rss / 1024 / 1024,  # Resident Set Size in MB
        "vms_mb": memory_info.vms / 1024 / 1024,  # Virtual Memory Size in MB
        "percent": process.memory_percent(),
        "available_mb": psutil.virtual_memory().available / 1024 / 1024
    }

@app.get("/health", response_model=HealthCheck)
async def health_check():
    """Health check endpoint with memory monitoring"""
    memory_usage = get_memory_usage()
    
    # Check if memory usage is acceptable (less than 80% of available)
    status = "healthy" if memory_usage["percent"] < 80 else "degraded"
    
    return HealthCheck(
        status=status,
        memory_usage=memory_usage,
        service="submission-service"
    )

@app.post("/process-csv", response_model=ProcessingResult)
async def process_csv(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """
    Process CSV file for bulk sample creation
    Memory-efficient processing using pandas chunking
    """
    start_time = asyncio.get_event_loop().time()
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    try:
        # Create temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
            # Stream file content to avoid loading entire file into memory
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name
        
        # Process CSV in chunks to manage memory
        samples_processed = 0
        samples_created = 0
        errors = []
        
        # Read CSV in chunks to manage memory usage
        chunk_size = 100  # Process 100 rows at a time
        for chunk in pd.read_csv(temp_file_path, chunksize=chunk_size):
            chunk_samples = []
            
            for index, row in chunk.iterrows():
                try:
                    # Convert pandas row to dict and validate
                    row_dict = row.to_dict()
                    
                    # Clean and validate data
                    sample_data = SampleData(
                        sample_name=str(row_dict.get('sample_name', '')).strip(),
                        project_id=str(row_dict.get('project_id', '')).strip() if row_dict.get('project_id') else None,
                        submitter_name=str(row_dict.get('submitter_name', '')).strip(),
                        submitter_email=str(row_dict.get('submitter_email', '')).strip(),
                        lab_name=str(row_dict.get('lab_name', '')).strip() if row_dict.get('lab_name') else None,
                        sample_type=str(row_dict.get('sample_type', '')).strip(),
                        sample_buffer=str(row_dict.get('sample_buffer', '')).strip() if row_dict.get('sample_buffer') else None,
                        concentration=float(row_dict.get('concentration')) if pd.notna(row_dict.get('concentration')) else None,
                        volume=float(row_dict.get('volume')) if pd.notna(row_dict.get('volume')) else None,
                        total_amount=float(row_dict.get('total_amount')) if pd.notna(row_dict.get('total_amount')) else None,
                        flow_cell_type=str(row_dict.get('flow_cell_type', '')).strip() if row_dict.get('flow_cell_type') else None,
                        flow_cell_count=int(row_dict.get('flow_cell_count')) if pd.notna(row_dict.get('flow_cell_count')) else None,
                        priority=str(row_dict.get('priority', 'normal')).strip(),
                        assigned_to=str(row_dict.get('assigned_to', '')).strip() if row_dict.get('assigned_to') else None,
                        library_prep_by=str(row_dict.get('library_prep_by', '')).strip() if row_dict.get('library_prep_by') else None,
                        chart_field=str(row_dict.get('chart_field', '')).strip()
                    )
                    
                    chunk_samples.append(sample_data.dict())
                    samples_processed += 1
                    
                except ValidationError as e:
                    errors.append(f"Row {index + 1}: {str(e)}")
                except Exception as e:
                    errors.append(f"Row {index + 1}: Unexpected error - {str(e)}")
            
            # Create samples in background if no validation errors
            if chunk_samples and not errors:
                if background_tasks:
                    background_tasks.add_task(create_samples_batch, chunk_samples)
                else:
                    # For immediate processing (not recommended for large files)
                    await create_samples_batch(chunk_samples)
                samples_created += len(chunk_samples)
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return ProcessingResult(
            success=len(errors) == 0,
            message=f"Processed {samples_processed} samples, created {samples_created}",
            samples_processed=samples_processed,
            samples_created=samples_created,
            errors=errors,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error processing CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")

@app.post("/process-pdf", response_model=ProcessingResult)
async def process_pdf(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """
    Process PDF file for sample data extraction
    Memory-efficient processing using pdfplumber
    """
    start_time = asyncio.get_event_loop().time()
    
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Create temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name
        
        extracted_data = []
        errors = []
        
        # Process PDF page by page to manage memory
        with pdfplumber.open(temp_file_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                try:
                    # Extract text from page
                    text = page.extract_text()
                    if text:
                        # Parse extracted text for sample data
                        sample_data = parse_pdf_text(text, page_num + 1)
                        if sample_data:
                            extracted_data.append(sample_data)
                except Exception as e:
                    errors.append(f"Page {page_num + 1}: {str(e)}")
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        # Create samples from extracted data
        samples_created = 0
        if extracted_data and not errors:
            if background_tasks:
                background_tasks.add_task(create_samples_batch, extracted_data)
            else:
                await create_samples_batch(extracted_data)
            samples_created = len(extracted_data)
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return ProcessingResult(
            success=len(errors) == 0,
            message=f"Extracted data from {len(extracted_data)} pages, created {samples_created} samples",
            samples_processed=len(extracted_data),
            samples_created=samples_created,
            errors=errors,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

def parse_pdf_text(text: str, page_num: int) -> Optional[Dict[str, Any]]:
    """
    Parse extracted PDF text to extract sample data
    This is a simplified parser - you may need to enhance based on your PDF format
    """
    try:
        # Basic text parsing logic - enhance based on your PDF structure
        lines = text.split('\n')
        sample_data = {}
        
        for line in lines:
            line = line.strip()
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower().replace(' ', '_')
                value = value.strip()
                
                if key in ['sample_name', 'project_id', 'submitter_name', 'submitter_email']:
                    sample_data[key] = value
        
        # Return None if no valid data found
        if not sample_data.get('sample_name'):
            return None
            
        return sample_data
        
    except Exception as e:
        logger.error(f"Error parsing PDF text on page {page_num}: {str(e)}")
        return None

async def create_samples_batch(samples: List[Dict[str, Any]]):
    """
    Create samples in the main application via API call
    This function communicates with the main nanopore tracking app
    """
    try:
        # Get the main app URL from environment
        main_app_url = os.getenv('MAIN_APP_URL', 'http://localhost:3001')
        
        async with httpx.AsyncClient() as client:
            for sample in samples:
                try:
                    response = await client.post(
                        f"{main_app_url}/api/trpc/nanopore.createSample",
                        json={
                            "json": sample
                        },
                        timeout=30.0
                    )
                    
                    if response.status_code != 200:
                        logger.error(f"Failed to create sample {sample.get('sample_name')}: {response.text}")
                    
                except Exception as e:
                    logger.error(f"Error creating sample {sample.get('sample_name')}: {str(e)}")
                    
    except Exception as e:
        logger.error(f"Error in create_samples_batch: {str(e)}")

@app.get("/memory-usage")
async def get_memory_usage_endpoint():
    """Get current memory usage statistics"""
    return get_memory_usage()

if __name__ == "__main__":
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    # Run with uvicorn
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=False,  # Disable reload in production
        workers=1,     # Single worker for memory efficiency
        log_level="info"
    ) 