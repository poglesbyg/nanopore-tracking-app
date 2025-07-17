"""PDF processing service with memory optimization."""
import io
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import pdfplumber
from PyPDF2 import PdfReader

from app.models.schemas import SampleData, ProcessingResult, ProcessingStatus
from app.core.config import settings


logger = logging.getLogger(__name__)


class PDFProcessor:
    """Service for processing PDF files with memory optimization."""
    
    def __init__(self):
        self.max_pages = settings.pdf_max_pages
        self.patterns = self._compile_patterns()
    
    def _compile_patterns(self) -> Dict[str, re.Pattern]:
        """Compile regex patterns for field extraction."""
        return {
            'sample_name': re.compile(r'Sample\s*(?:Name|ID)[:\s]*([^\n]+)', re.IGNORECASE),
            'submitter_name': re.compile(r'(?:Submitter|Contact)\s*Name[:\s]*([^\n]+)', re.IGNORECASE),
            'submitter_email': re.compile(r'(?:Email|E-mail)[:\s]*([^\s@]+@[^\s@]+\.[^\s@]+)', re.IGNORECASE),
            'concentration': re.compile(r'Concentration[:\s]*(\d+\.?\d*)\s*(ng/[μu]l|ng/ul)', re.IGNORECASE),
            'volume': re.compile(r'Volume[:\s]*(\d+\.?\d*)\s*([μu]l|ul)', re.IGNORECASE),
            'organism': re.compile(r'(?:Organism|Species)[:\s]*([^\n]+)', re.IGNORECASE),
            'buffer': re.compile(r'Buffer[:\s]*([^\n]+)', re.IGNORECASE),
        }
    
    async def process_file(self, file_content: bytes, filename: str) -> ProcessingResult:
        """Process a PDF file and extract sample data."""
        start_time = datetime.now()
        errors = []
        warnings = []
        samples = []
        
        try:
            # Process PDF page by page to minimize memory usage
            text_content = await self._extract_text_optimized(file_content)
            
            if not text_content:
                return ProcessingResult(
                    status=ProcessingStatus.FAILED,
                    message="No text content found in PDF",
                    errors=["PDF appears to be empty or contains only images"]
                )
            
            # Extract sample data
            sample_data = self._extract_sample_data(text_content)
            
            if sample_data:
                samples.append(sample_data)
                status = ProcessingStatus.COMPLETED
                message = f"Successfully processed PDF: {filename}"
            else:
                status = ProcessingStatus.COMPLETED
                message = "PDF processed but no sample data found"
                warnings.append("No recognizable sample data patterns found")
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return ProcessingResult(
                status=status,
                message=message,
                data=samples,
                errors=errors,
                warnings=warnings,
                processing_time=processing_time,
                metadata={
                    "filename": filename,
                    "pages_processed": len(text_content.split('\n\n')),
                    "text_length": len(text_content)
                }
            )
            
        except Exception as e:
            logger.error(f"Error processing PDF {filename}: {str(e)}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                message=f"Failed to process PDF: {str(e)}",
                errors=[str(e)],
                processing_time=(datetime.now() - start_time).total_seconds()
            )
    
    async def _extract_text_optimized(self, file_content: bytes) -> str:
        """Extract text from PDF with memory optimization."""
        text_parts = []
        
        try:
            # Try pdfplumber first (better for tables)
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                for i, page in enumerate(pdf.pages):
                    if i >= self.max_pages:
                        logger.warning(f"PDF has more than {self.max_pages} pages, truncating")
                        break
                    
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                    
                    # Clear page object to free memory
                    page.close()
        
        except Exception as e:
            logger.warning(f"pdfplumber failed, trying PyPDF2: {str(e)}")
            
            # Fallback to PyPDF2
            try:
                reader = PdfReader(io.BytesIO(file_content))
                for i, page in enumerate(reader.pages):
                    if i >= self.max_pages:
                        break
                    
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
            
            except Exception as e2:
                logger.error(f"Both PDF libraries failed: {str(e2)}")
                raise
        
        return '\n\n'.join(text_parts)
    
    def _extract_sample_data(self, text: str) -> Optional[SampleData]:
        """Extract sample data from text using patterns."""
        data = {}
        
        for field, pattern in self.patterns.items():
            match = pattern.search(text)
            if match:
                value = match.group(1).strip()
                
                # Convert numeric fields
                if field in ['concentration', 'volume']:
                    try:
                        data[field] = float(value)
                    except ValueError:
                        logger.warning(f"Could not convert {field} value: {value}")
                else:
                    data[field] = value
        
        # Check if we have minimum required fields
        if 'sample_name' in data or 'submitter_name' in data:
            # Set defaults for required fields
            data.setdefault('sample_name', 'Unknown')
            data.setdefault('submitter_name', 'Unknown')
            data.setdefault('submitter_email', 'unknown@example.com')
            
            return SampleData(**data)
        
        return None 