"""Unit tests for CSV processor."""
import pytest
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.csv_processor import CSVProcessor
from app.models.schemas import ProcessingStatus


class TestCSVProcessor:
    """Test CSV processing service."""
    
    @pytest.fixture
    def csv_processor(self):
        """Create CSV processor instance."""
        return CSVProcessor()
    
    @pytest.mark.asyncio
    async def test_process_valid_csv(self, csv_processor, sample_csv_content):
        """Test processing a valid CSV file."""
        result = await csv_processor.process_file(sample_csv_content, "test.csv")
        
        assert result.status == ProcessingStatus.COMPLETED
        assert len(result.data) == 3
        assert result.data[0].sample_name == "TEST-001"
        assert result.data[0].concentration == 50.5
        assert result.data[1].sample_name == "TEST-002"
        assert result.data[2].sample_name == "TEST-003"
    
    @pytest.mark.asyncio
    async def test_process_empty_csv(self, csv_processor):
        """Test processing an empty CSV."""
        empty_csv = b"sample_name,submitter_name,email\n"
        result = await csv_processor.process_file(empty_csv, "empty.csv")
        
        assert result.status == ProcessingStatus.COMPLETED
        assert len(result.data) == 0
        assert "no valid samples found" in result.message
    
    @pytest.mark.asyncio
    async def test_process_invalid_csv(self, csv_processor):
        """Test processing CSV with no recognizable columns."""
        invalid_csv = b"col1,col2,col3\nval1,val2,val3"
        result = await csv_processor.process_file(invalid_csv, "invalid.csv")
        
        assert result.status == ProcessingStatus.FAILED
        assert "No recognizable columns" in result.message
    
    def test_column_mapping(self, csv_processor):
        """Test column mapping functionality."""
        columns = ["Sample Name", "Contact", "Email Address", "Conc", "Vol"]
        mapping = csv_processor._map_columns(columns)
        
        assert mapping['sample_name'] == "Sample Name"
        assert mapping['submitter_name'] == "Contact"
        assert mapping['submitter_email'] == "Email Address"
        assert mapping['concentration'] == "Conc"
        assert mapping['volume'] == "Vol" 