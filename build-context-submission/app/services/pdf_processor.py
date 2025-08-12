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
        """Process a PDF file and extract sample data and table rows when present."""
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

            # Try to extract a structured sample table using pdfplumber
            try:
                table_rows = self._extract_table_rows(file_content)
                if table_rows:
                    # Attach table rows to the primary sample payload so downstream can fan-out
                    if not sample_data:
                        # Ensure we still return a minimal object with submitter defaults
                        sample_data = SampleData(
                            sample_name='Unknown',
                            submitter_name='Unknown',
                            submitter_email='unknown@example.com',
                            metadata={}
                        )
                    # type: ignore[attr-defined] - pydantic will accept extra field we declared
                    sample_data.sample_table = table_rows  # type: ignore
            except Exception as te:
                logger.warning(f"Table extraction failed: {te}")
            
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

    def _extract_table_rows(self, file_content: bytes) -> List[Dict[str, Any]]:
        """Extract a sample table from the PDF using pdfplumber and normalize headers.

        Returns a list of dict rows with keys matching downstream expectations:
        - sample_name, volume, nanodrop_conc, qubit_conc, a260_280, a260_230, sample_index
        """
        rows: List[Dict[str, Any]] = []
        header_map_candidates = {
            'sample_name': ['sample name', 'sample id', 'sample', 'name', 'id'],
            'volume': ['volume', 'vol', 'µl', 'ul'],
            'nanodrop_conc': ['nanodrop', 'nanodrop conc', 'nd conc', 'nd (ng/µl)', 'nanodrop (ng/µl)'],
            'qubit_conc': ['qubit', 'qubit conc', 'qubit (ng/µl)'],
            'a260_280': ['a260/280', '260/280', 'a260-280', 'ratio 260/280', '260-280'],
            'a260_230': ['a260/230', '260/230', 'a260-230', 'ratio 260/230', '260-230'],
        }

        def normalize(s: str) -> str:
            return s.strip().lower().replace('\u00b5', 'µ')  # normalize micro symbol if needed

        try:
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                page_index = 0
                for page in pdf.pages:
                    if page_index >= self.max_pages:
                        break
                    page_index += 1
                    try:
                        tables = page.extract_tables() or []
                    except Exception as e:
                        logger.debug(f"pdfplumber extract_tables error on page {page_index}: {e}")
                        continue

                    for tbl in tables:
                        if not tbl or len(tbl) < 2:
                            continue
                        header = [normalize(h or '') for h in tbl[0]]
                        # Build header index map
                        col_map: Dict[str, int] = {}
                        for key, candidates in header_map_candidates.items():
                            for idx, h in enumerate(header):
                                if any(c in h for c in candidates) and key not in col_map:
                                    col_map[key] = idx
                                    break

                        # Require at minimum a recognizable sample_name column to accept table
                        if 'sample_name' not in col_map:
                            continue

                        for i, raw_row in enumerate(tbl[1:], start=1):
                            if not raw_row or all((cell is None or str(cell).strip() == '') for cell in raw_row):
                                continue

                            def get_val(key: str) -> Optional[str]:
                                idx = col_map.get(key)
                                if idx is None or idx >= len(raw_row):
                                    return None
                                cell = raw_row[idx]
                                return None if cell is None else str(cell).strip()

                            def to_float(v: Optional[str]) -> Optional[float]:
                                if not v:
                                    return None
                                try:
                                    # remove common units and commas
                                    cleaned = v.lower().replace('ng/µl', '').replace('ng/ul', '').replace(',', '').strip()
                                    return float(cleaned)
                                except Exception:
                                    return None

                            sample_name = get_val('sample_name') or ''
                            if sample_name.lower() in ('sample', 'sample name', 'name', 'id'):
                                # header-like row
                                continue

                            row_obj: Dict[str, Any] = {
                                'sample_name': sample_name,
                                'volume': to_float(get_val('volume')),
                                'nanodrop_conc': to_float(get_val('nanodrop_conc')),
                                'qubit_conc': to_float(get_val('qubit_conc')),
                                'a260_280': to_float(get_val('a260_280')),
                                'a260_230': to_float(get_val('a260_230')),
                                'sample_index': i,
                            }

                            # Heuristic: skip completely empty rows
                            if not row_obj['sample_name'] and all(v is None for k, v in row_obj.items() if k != 'sample_name'):
                                continue

                            rows.append(row_obj)
        except Exception as e:
            logger.debug(f"Table parsing failed: {e}")

        return rows