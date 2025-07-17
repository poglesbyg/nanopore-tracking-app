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
    Parse extracted PDF text to extract sample data from HTSF quote forms
    Enhanced parser for nanopore sequencing submission forms
    
    Handles HTSF quote forms with the following structure:
    - Quote ID (e.g., HTSF--JL-147)
    - Sample information section
    - Flow cell selection
    - Bioinformatics and data delivery options
    """
    try:
        import re
        lines = text.split('\n')
        sample_data = {}
        
        # Initialize with defaults
        sample_data['status'] = 'pending'
        sample_data['priority'] = 'normal'
        
        # Extract HTSF Quote ID (e.g., HTSF--JL-147)
        htsf_pattern = r'(HTSF--[A-Z]+-\d+)'
        for line in lines:
            match = re.search(htsf_pattern, line)
            if match:
                sample_data['chart'] = match.group(1)
                sample_data['sample_name'] = match.group(1)  # Use as sample name if no other name found
                break
        
        # Parse the form sections
        current_section = None
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Identify sections
            if 'Sample Information' in line:
                current_section = 'sample_info'
            elif 'Flow Cell Selection' in line:
                current_section = 'flow_cell'
            elif 'Bioinformatics' in line:
                current_section = 'bioinformatics'
            elif 'Type of Sample' in line:
                current_section = 'sample_type'
            elif 'Source Organism' in line:
                current_section = 'organism'
            
            # Extract data based on current section
            if current_section == 'sample_info':
                # Look for sample details in a table format
                if 'Sample Name' in line and i + 1 < len(lines):
                    # Check next few lines for sample data
                    for j in range(1, min(5, len(lines) - i)):
                        data_line = lines[i + j].strip()
                        if data_line and not any(header in data_line for header in ['Sample Name', 'Concentration', 'Volume']):
                            # Parse sample data row
                            parts = data_line.split()
                            if parts:
                                # First part is usually sample name
                                sample_data['sample_name'] = parts[0]
                                
                                # Look for concentration (ng/μL pattern)
                                for part in parts:
                                    if 'ng/' in part or part.replace('.', '').isdigit():
                                        try:
                                            conc_value = float(re.sub(r'[^\d.]', '', part))
                                            if conc_value > 0:
                                                sample_data['concentration'] = conc_value
                                                break
                                        except:
                                            pass
                                
                                # Look for volume (μL pattern)
                                for k, part in enumerate(parts):
                                    if 'μL' in part or 'ul' in part.lower():
                                        try:
                                            vol_value = float(re.sub(r'[^\d.]', '', part))
                                            if vol_value > 0:
                                                sample_data['volume'] = vol_value
                                        except:
                                            # Try previous part if current has unit only
                                            if k > 0:
                                                try:
                                                    vol_value = float(parts[k-1])
                                                    if vol_value > 0:
                                                        sample_data['volume'] = vol_value
                                                except:
                                                    pass
                            break
            
            elif current_section == 'flow_cell':
                # Extract flow cell type (R10.4.1, R9.4.1, etc.)
                if 'R10' in line or 'R9' in line:
                    flow_cell_match = re.search(r'(R\d+\.\d+\.\d+)', line)
                    if flow_cell_match:
                        sample_data['flow_cell_type'] = flow_cell_match.group(1)
                # Check for PromethION or MinION
                elif 'PromethION' in line:
                    sample_data['flow_cell_type'] = 'PromethION'
                elif 'MinION' in line:
                    sample_data['flow_cell_type'] = 'MinION'
            
            elif current_section == 'sample_type':
                # Look for DNA/RNA selection
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if 'DNA' in next_line.upper() and 'RNA' not in next_line.upper():
                        sample_data['sample_type'] = 'DNA'
                    elif 'RNA' in next_line.upper():
                        sample_data['sample_type'] = 'RNA'
            
            elif current_section == 'organism':
                # Extract organism information
                if ':' in line:
                    organism_value = line.split(':', 1)[1].strip()
                    if organism_value and organism_value.lower() not in ['na', 'n/a', 'none']:
                        sample_data['organism'] = organism_value
                elif i + 1 < len(lines) and current_section == 'organism':
                    # Check next line for organism
                    next_line = lines[i + 1].strip()
                    if next_line and ':' not in next_line and not any(keyword in next_line for keyword in ['Sample', 'Type', 'Buffer']):
                        sample_data['organism'] = next_line
            
            # Extract submitter information (anywhere in the form)
            if '@' in line:
                # Email pattern
                email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', line)
                if email_match:
                    sample_data['submitter_email'] = email_match.group(0)
                    # Try to extract name before email
                    before_email = line[:line.find(email_match.group(0))].strip()
                    if before_email:
                        # Remove common prefixes
                        name = before_email.replace('Contact:', '').replace('Email:', '').strip()
                        if name and len(name) > 2:
                            sample_data['submitter_name'] = name
            
            # Extract dates
            date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', line)
            if date_match and 'created_at' not in sample_data:
                sample_data['created_at'] = date_match.group(1)
            
            # Extract cost/quote information
            if '$' in line:
                cost_match = re.search(r'\$\s*([\d,]+\.?\d*)', line)
                if cost_match:
                    sample_data['estimated_cost'] = cost_match.group(1).replace(',', '')
            
            i += 1
        
        # Validate required fields
        if 'sample_name' in sample_data or 'chart' in sample_data:
            # Set defaults for missing fields
            if 'sample_type' not in sample_data:
                sample_data['sample_type'] = 'DNA'  # Default to DNA
            if 'concentration' not in sample_data:
                sample_data['concentration'] = 0.0
            if 'volume' not in sample_data:
                sample_data['volume'] = 0.0
            
            # Add metadata
            sample_data['pdf_page'] = page_num
            sample_data['extraction_method'] = 'pdf_htsf_quote'
            
            return sample_data
        
        return None
        
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