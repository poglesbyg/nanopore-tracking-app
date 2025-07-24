"""PDF processing service with memory optimization."""
import io
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import pdfplumber
from PyPDF2 import PdfReader
import httpx

from app.models.schemas import SampleData, ProcessingResult, ProcessingStatus
from app.core.config import settings


logger = logging.getLogger(__name__)


class PDFProcessor:
    """Service for processing PDF files with memory optimization."""
    
    def __init__(self):
        self.max_pages = settings.pdf_max_pages
        self.patterns = self._compile_patterns()
        self.ai_service_url = settings.ai_service_url
        self.ai_service_timeout = settings.ai_service_timeout
    
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
            
            # Enhanced nanopore-specific patterns
            'quote_identifier': re.compile(r'(?:Quote|Identifier)[:\s]*([^\n]+)', re.IGNORECASE),
            'lab_name': re.compile(r'Lab[:\s]*([^\n]+)', re.IGNORECASE),
            'phone': re.compile(r'Phone[:\s]*([^\n]+)', re.IGNORECASE),
            'sample_type': re.compile(r'Type\s*of\s*Sample[:\s]*([^\n]+)', re.IGNORECASE),
            'flow_cell': re.compile(r'Flow\s*Cell[:\s]*([^\n]+)', re.IGNORECASE),
            'genome_size': re.compile(r'(?:Genome\s*Size|Approx\.\s*Genome\s*Size)[:\s]*([^\n]+)', re.IGNORECASE),
            'coverage': re.compile(r'(?:Coverage|Approx\.\s*Coverage)[:\s]*([^\n]+)', re.IGNORECASE),
            'cost': re.compile(r'(?:Projected\s*Cost|Cost)[:\s]*\$?([^\n]+)', re.IGNORECASE),
            'basecalling': re.compile(r'basecalled\s*using[:\s]*([^\n]+)', re.IGNORECASE),
            'file_format': re.compile(r'File\s*Format[:\s]*([^\n]+)', re.IGNORECASE),
            'service_requested': re.compile(r'Service\s*Requested[:\s]*([^\n]+)', re.IGNORECASE),
            'sequencing_type': re.compile(r'I\s*will\s*be\s*submitting.*?for[:\s]*([^\n]+)', re.IGNORECASE),
            
            # Additional comprehensive patterns
            'pi_name': re.compile(r'PI[:\s]*([^\n]+)', re.IGNORECASE),
            'department': re.compile(r'Department[:\s]*([^\n]+)', re.IGNORECASE),
            'institution': re.compile(r'Institution[:\s]*([^\n]+)', re.IGNORECASE),
            'project_description': re.compile(r'Project\s*Description[:\s]*([^\n]+)', re.IGNORECASE),
            'data_delivery': re.compile(r'Data\s*Delivery[:\s]*([^\n]+)', re.IGNORECASE),
            'billing_account': re.compile(r'Billing\s*Account[:\s]*([^\n]+)', re.IGNORECASE),
            'special_instructions': re.compile(r'Special\s*Instructions[:\s]*([^\n]+)', re.IGNORECASE),
            'expected_yield': re.compile(r'Expected\s*Yield[:\s]*([^\n]+)', re.IGNORECASE),
            'library_prep': re.compile(r'Library\s*Prep[:\s]*([^\n]+)', re.IGNORECASE),
            'multiplexing': re.compile(r'Multiplexing[:\s]*([^\n]+)', re.IGNORECASE),
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
            
            # Extract sample data using regex patterns
            sample_data = self._extract_sample_data(text_content)
            
            # If basic extraction didn't find much, try AI-enhanced extraction
            if not sample_data or len(sample_data.__dict__) < 5:
                logger.info(f"Basic extraction found limited data, trying AI-enhanced extraction for {filename}")
                ai_enhanced_data = await self._extract_with_ai(text_content, filename)
                if ai_enhanced_data:
                    # Merge AI-extracted data with basic extraction
                    if sample_data:
                        for key, value in ai_enhanced_data.items():
                            if not getattr(sample_data, key, None) and value:
                                setattr(sample_data, key, value)
                    else:
                        sample_data = SampleData(**ai_enhanced_data)
            
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
                    "text_length": len(text_content),
                    "ai_enhanced": bool(sample_data and hasattr(sample_data, '_ai_enhanced'))
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
    
    async def _extract_with_ai(self, text_content: str, filename: str) -> Optional[Dict[str, Any]]:
        """Use AI service to extract data from PDF text."""
        try:
            async with httpx.AsyncClient(timeout=self.ai_service_timeout) as client:
                response = await client.post(
                    f"{self.ai_service_url}/api/extract/text",
                    json={
                        "text": text_content[:10000],  # Limit text to prevent oversized requests
                        "extractionPrompt": "Extract sample submission information including sample names, submitter details, organism, concentration, volume, and any nanopore-specific fields",
                        "fields": [
                            "sample_name", "submitter_name", "submitter_email",
                            "organism", "concentration", "volume", "buffer",
                            "quote_identifier", "lab_name", "phone", "sample_type",
                            "flow_cell", "genome_size", "coverage", "pi_name"
                        ]
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    extracted_data = {}
                    
                    # Convert AI response to our format
                    for field in result.get("extractedFields", []):
                        field_name = field.get("fieldName")
                        field_value = field.get("value")
                        if field_name and field_value:
                            # Convert numeric fields
                            if field_name in ["concentration", "volume"]:
                                try:
                                    extracted_data[field_name] = float(re.findall(r'[\d.]+', field_value)[0])
                                except (ValueError, IndexError):
                                    extracted_data[field_name] = field_value
                            else:
                                extracted_data[field_name] = field_value
                    
                    if extracted_data:
                        extracted_data["_ai_enhanced"] = True
                        logger.info(f"AI extraction found {len(extracted_data)} fields for {filename}")
                        return extracted_data
                else:
                    logger.warning(f"AI service returned status {response.status_code}: {response.text}")
                    
        except httpx.TimeoutException:
            logger.warning(f"AI service timeout for {filename}")
        except Exception as e:
            logger.warning(f"AI extraction failed for {filename}: {str(e)}")
        
        return None
    
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
        if any(key in data for key in ['sample_name', 'submitter_name', 'quote_identifier', 'lab_name']):
            # Set defaults for required fields
            data.setdefault('sample_name', data.get('quote_identifier', 'Unknown'))
            data.setdefault('submitter_name', 'Unknown')
            data.setdefault('submitter_email', 'unknown@example.com')
            
            return SampleData(**data)
        
        return None
    
    def _extract_sample_table(self, text: str) -> List[Dict[str, Any]]:
        """Extract sample table data from text."""
        samples = []
        
        # For multi-page tables, we need to extract all table sections
        # Look for all occurrences of sample table headers
        table_header_pattern = re.compile(
            r'Sample\s*(?:Name|ID)\s*.*?(?:Volume|Vol).*?(?:Conc)', 
            re.IGNORECASE
        )
        
        # Find all table headers (indicating table sections)
        headers = list(table_header_pattern.finditer(text))
        
        if not headers:
            return samples
        
        # Process each table section
        table_sections = []
        for i, header in enumerate(headers):
            start = header.start()
            # End at next header or end of text
            end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
            table_sections.append(text[start:end])
        
        # Combine all table sections
        table_text = '\n'.join(table_sections)
        
        # Multiple patterns for sample rows to handle different formats
        sample_row_patterns = [
            # Pattern 1: HTSF format - Sample#, Volume, Qubit, Nanodrop, A260/A280, A260/A230(optional)
            # Use $ to ensure we don't match into the next line
            re.compile(
                r'^(\d+)\s+(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)(?:\s+(\d+\.?\d*))?$', 
                re.MULTILINE
            ),
            # Pattern 2: Sample Name/ID, Volume, Concentration (with units)
            re.compile(
                r'(\w+[-\w]*)\s+(\d+\.?\d*)\s*(?:μl|ul)\s+(\d+\.?\d*)\s*(?:ng/μl|ng/ul)', 
                re.IGNORECASE | re.MULTILINE
            ),
            # Pattern 3: Numbered samples with name and measurements
            re.compile(
                r'(\d+)\s+([A-Za-z0-9_-]+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)', 
                re.MULTILINE
            ),
            # Pattern 4: Simple sample data with name and measurements
            re.compile(
                r'([A-Za-z0-9_-]+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)', 
                re.MULTILINE
            )
        ]
        
        for i, pattern in enumerate(sample_row_patterns):
            matches = pattern.finditer(table_text)
            for match in matches:
                groups = match.groups()
                
                # Handle different group patterns
                if i == 0 and len(groups) >= 5:  # Pattern 1 (HTSF): sample#, vol, qubit, nanodrop, A260/A280, A260/A230
                    sample = {
                        'sample_index': groups[0],
                        'sample_name': groups[0],  # Use sample number as name
                        'volume': float(groups[1]) if groups[1] else None,
                        'qubit_conc': float(groups[2]) if groups[2] else None,
                        'nanodrop_conc': float(groups[3]) if groups[3] else None
                    }
                elif i == 2 and len(groups) >= 5:  # Pattern 3: index, name, vol, conc1, conc2
                    sample = {
                        'sample_index': groups[0],
                        'sample_name': groups[1],
                        'volume': float(groups[2]) if groups[2] else None,
                        'qubit_conc': float(groups[3]) if groups[3] else None,
                        'nanodrop_conc': float(groups[4]) if groups[4] else None
                    }
                elif len(groups) >= 3:  # Pattern 2 or 4: name, vol, conc
                    sample = {
                        'sample_name': groups[0],
                        'volume': float(groups[1]) if groups[1] else None,
                        'concentration': float(groups[2]) if groups[2] else None
                    }
                    # Add qubit_conc as alias for concentration
                    if sample.get('concentration'):
                        sample['qubit_conc'] = sample['concentration']
                
                    if len(groups) >= 4 and groups[3]:  # Additional concentration
                        sample['nanodrop_conc'] = float(groups[3])
                
                samples.append(sample)
            
            # If we found samples with this pattern, break
            if samples:
                break
        
        # Also look for special entries like "Positive control" and "BLANK"
        special_pattern = re.compile(r'^(\d+)\s+(Positive control|BLANK|Negative control)', re.MULTILINE | re.IGNORECASE)
        special_matches = special_pattern.finditer(table_text)
        for match in special_matches:
            sample = {
                'sample_index': match.group(1),
                'sample_name': match.group(2),
                'volume': None,
                'qubit_conc': None,
                'nanodrop_conc': None
            }
            samples.append(sample)
        
        # Remove duplicates based on sample_name
        unique_samples = []
        seen_names = set()
        for sample in samples:
            name = sample.get('sample_name', '')
            if name and name not in seen_names:
                seen_names.add(name)
                unique_samples.append(sample)
        
        return unique_samples 