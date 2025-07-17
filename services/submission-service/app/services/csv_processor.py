"""CSV processing service with memory optimization."""
import io
import logging
from typing import List, Optional
from datetime import datetime
import pandas as pd

from app.models.schemas import SampleData, ProcessingResult, ProcessingStatus
from app.core.config import settings


logger = logging.getLogger(__name__)


class CSVProcessor:
    """Service for processing CSV files with chunked reading."""
    
    def __init__(self):
        self.chunk_size = settings.csv_chunk_size
        self.required_columns = {
            'sample_name': ['sample_name', 'sample', 'name', 'id'],
            'submitter_name': ['submitter_name', 'submitter', 'contact'],
            'submitter_email': ['email', 'submitter_email', 'contact_email'],
            'concentration': ['concentration', 'conc'],
            'volume': ['volume', 'vol'],
            'organism': ['organism', 'species'],
            'buffer': ['buffer', 'solution']
        }
    
    async def process_file(self, file_content: bytes, filename: str) -> ProcessingResult:
        """Process a CSV file and extract sample data."""
        start_time = datetime.now()
        errors = []
        warnings = []
        samples = []
        total_rows = 0
        
        try:
            # Process CSV in chunks to minimize memory usage
            file_io = io.StringIO(file_content.decode('utf-8'))
            
            # Read header first to map columns
            header = pd.read_csv(file_io, nrows=0)
            column_mapping = self._map_columns(header.columns.tolist())
            
            if not column_mapping:
                return ProcessingResult(
                    status=ProcessingStatus.FAILED,
                    message="No recognizable columns found in CSV",
                    errors=["CSV must contain sample information columns"]
                )
            
            # Reset file pointer
            file_io.seek(0)
            
            # Process in chunks
            for chunk in pd.read_csv(file_io, chunksize=self.chunk_size):
                chunk_samples, chunk_errors = self._process_chunk(chunk, column_mapping)
                samples.extend(chunk_samples)
                errors.extend(chunk_errors)
                total_rows += len(chunk)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            if samples:
                status = ProcessingStatus.COMPLETED
                message = f"Successfully processed {len(samples)} samples from {total_rows} rows"
            else:
                status = ProcessingStatus.COMPLETED
                message = "CSV processed but no valid samples found"
                warnings.append(f"Processed {total_rows} rows but found no valid samples")
            
            return ProcessingResult(
                status=status,
                message=message,
                data=samples,
                errors=errors,
                warnings=warnings,
                processing_time=processing_time,
                metadata={
                    "filename": filename,
                    "total_rows": total_rows,
                    "valid_samples": len(samples),
                    "columns_mapped": list(column_mapping.keys())
                }
            )
            
        except Exception as e:
            logger.error(f"Error processing CSV {filename}: {str(e)}")
            return ProcessingResult(
                status=ProcessingStatus.FAILED,
                message=f"Failed to process CSV: {str(e)}",
                errors=[str(e)],
                processing_time=(datetime.now() - start_time).total_seconds()
            )
    
    def _map_columns(self, csv_columns: List[str]) -> dict:
        """Map CSV columns to our data model fields."""
        mapping = {}
        csv_columns_lower = [col.lower().strip() for col in csv_columns]
        
        for field, possible_names in self.required_columns.items():
            for csv_col, csv_col_lower in zip(csv_columns, csv_columns_lower):
                if any(name in csv_col_lower for name in possible_names):
                    mapping[field] = csv_col
                    break
        
        return mapping
    
    def _process_chunk(self, chunk: pd.DataFrame, column_mapping: dict) -> tuple:
        """Process a chunk of CSV data."""
        samples = []
        errors = []
        
        for idx, row in chunk.iterrows():
            try:
                sample_data = self._extract_row_data(row, column_mapping)
                if sample_data:
                    samples.append(sample_data)
            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")
        
        return samples, errors
    
    def _extract_row_data(self, row: pd.Series, column_mapping: dict) -> Optional[SampleData]:
        """Extract sample data from a CSV row."""
        data = {}
        
        for field, csv_column in column_mapping.items():
            value = row.get(csv_column)
            
            if pd.notna(value):
                # Convert numeric fields
                if field in ['concentration', 'volume']:
                    try:
                        data[field] = float(value)
                    except (ValueError, TypeError):
                        logger.warning(f"Could not convert {field} value: {value}")
                else:
                    data[field] = str(value).strip()
        
        # Check if we have minimum required fields
        if 'sample_name' in data or 'submitter_name' in data:
            # Set defaults for required fields
            data.setdefault('sample_name', 'Unknown')
            data.setdefault('submitter_name', 'Unknown')
            data.setdefault('submitter_email', 'unknown@example.com')
            
            return SampleData(**data)
        
        return None 