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
            # Basic sample information
            'sample_name': re.compile(r'Sample\s*(?:Name|ID)[:\s]*([^\n]+)', re.IGNORECASE),
            'submitter_name': re.compile(r'(?:Submitter|Contact|Requester)[:\s]*([^\n]+)', re.IGNORECASE),
            'submitter_email': re.compile(r'(?:Email|E-mail)[:\s]*([^\s@]+@[^\s@]+\.[^\s@]+)', re.IGNORECASE),
            'concentration': re.compile(r'Concentration[:\s]*(\d+\.?\d*)\s*(ng/[μu]l|ng/ul)', re.IGNORECASE),
            'volume': re.compile(r'Volume[:\s]*(\d+\.?\d*)\s*([μu]l|ul)', re.IGNORECASE),
            'organism': re.compile(r'(?:Organism|Species|Source\s*Organism)[:\s]*([^\n]+)', re.IGNORECASE),
            'buffer': re.compile(r'(?:Buffer|Sample\s*Buffer)[:\s]*([^\n]+)', re.IGNORECASE),
            
            # Nanopore-specific patterns
            'quote_identifier': re.compile(r'Identifier[:\s]*([^\n]+)', re.IGNORECASE),
            'lab': re.compile(r'Lab[:\s]*([^\n]+)', re.IGNORECASE),
            'phone': re.compile(r'Phone[:\s]*([^\n]+)', re.IGNORECASE),
            'sample_type': re.compile(r'Type\s*of\s*Sample[:\s]*([^\n]+)', re.IGNORECASE),
            'flow_cell': re.compile(r'Flow\s*Cell[:\s]*([^\n]+)', re.IGNORECASE),
            'genome_size': re.compile(r'Genome\s*Size[:\s]*([^\n]+)', re.IGNORECASE),
            'coverage': re.compile(r'Coverage[:\s]*([^\n]+)', re.IGNORECASE),
            'cost': re.compile(r'(?:Projected\s*Cost|Cost)[:\s]*\$?([^\n]+)', re.IGNORECASE),
            'basecalling': re.compile(r'basecalled\s*using[:\s]*([^\n]+)', re.IGNORECASE),
            'file_format': re.compile(r'File\s*Format[:\s]*([^\n]+)', re.IGNORECASE),
            'service_requested': re.compile(r'Service\s*Requested[:\s]*([^\n]+)', re.IGNORECASE),
            'sequencing_type': re.compile(r'I\s*will\s*be\s*submitting.*?for[:\s]*([^\n]+)', re.IGNORECASE),
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
        
        # Extract basic patterns
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
        
        # Extract sample table data
        sample_table = self._extract_sample_table(text)
        if sample_table:
            data['sample_table'] = sample_table
        
        # Extract additional metadata
        metadata = {}
        
        # Extract PI information
        pi_match = re.search(r'PIs[:\s]*([^\n]+)', text, re.IGNORECASE)
        if pi_match:
            metadata['pi'] = pi_match.group(1).strip()
        
        # Extract billing information
        billing_match = re.search(r'Billing\s*address[:\s]*([^\n]+)', text, re.IGNORECASE)
        if billing_match:
            metadata['billing_address'] = billing_match.group(1).strip()
        
        # Extract comments
        comments_match = re.search(r'Additional\s*Comments[:\s]*([^\n]+)', text, re.IGNORECASE)
        if comments_match:
            metadata['comments'] = comments_match.group(1).strip()
        
        # Extract data delivery information
        delivery_match = re.search(r'Data\s*Delivery.*?email[:\s]*([^\n]+)', text, re.IGNORECASE | re.DOTALL)
        if delivery_match:
            metadata['data_delivery_email'] = delivery_match.group(1).strip()
        
        if metadata:
            data['metadata'] = metadata
        
        # Check if we have minimum required fields
        if any(key in data for key in ['sample_name', 'submitter_name', 'quote_identifier', 'lab']):
            # Set defaults for required fields
            data.setdefault('sample_name', data.get('quote_identifier', 'Unknown'))
            data.setdefault('submitter_name', 'Unknown')
            data.setdefault('submitter_email', 'unknown@example.com')
            
            return SampleData(**data)
        
        return None
    
    def _extract_sample_table(self, text: str) -> List[Dict[str, Any]]:
        """Extract sample table data from text."""
        samples = []
        
        # Look for sample table patterns
        table_pattern = re.compile(
            r'Sample\s*Name\s*Volume.*?(?=\n\n|\Z)', 
            re.IGNORECASE | re.DOTALL
        )
        
        table_match = table_pattern.search(text)
        if not table_match:
            return samples
        
        table_text = table_match.group(0)
        
        # Extract individual sample rows
        sample_row_pattern = re.compile(
            r'(\d+)\s+(\d+)\s+(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)', 
            re.MULTILINE
        )
        
        for match in sample_row_pattern.finditer(table_text):
            sample = {
                'sample_name': match.group(1),
                'sample_id': match.group(2),
                'volume': float(match.group(3)),
                'qubit_conc': float(match.group(4)),
                'nanodrop_conc': float(match.group(5))
            }
            samples.append(sample)
        
        return samples 