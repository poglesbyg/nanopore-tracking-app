"""Unit tests for PDF processor."""
import pytest
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.pdf_processor import PDFProcessor
from app.models.schemas import ProcessingStatus


class TestPDFProcessor:
    """Test PDF processing service."""
    
    @pytest.fixture
    def pdf_processor(self):
        """Create PDF processor instance."""
        return PDFProcessor()
    
    @pytest.mark.asyncio
    async def test_process_valid_pdf(self, pdf_processor, sample_pdf_content):
        """Test processing a valid PDF file."""
        result = await pdf_processor.process_file(sample_pdf_content, "test.pdf")
        
        assert result.status == ProcessingStatus.COMPLETED
        assert len(result.data) == 1
        assert result.data[0].sample_name == "TEST-001"
        assert result.data[0].submitter_name == "John Doe"
        assert result.data[0].submitter_email == "john.doe@example.com"
        assert result.data[0].concentration == 50.5
        assert result.data[0].volume == 30.0
    
    @pytest.mark.asyncio
    async def test_process_empty_pdf(self, pdf_processor):
        """Test processing an empty PDF."""
        empty_pdf = b"%PDF-1.4\n%%EOF"
        result = await pdf_processor.process_file(empty_pdf, "empty.pdf")
        
        assert result.status == ProcessingStatus.FAILED
        assert "Failed to process PDF" in result.message
    
    @pytest.mark.asyncio
    async def test_process_invalid_pdf(self, pdf_processor):
        """Test processing invalid PDF content."""
        invalid_content = b"This is not a PDF"
        result = await pdf_processor.process_file(invalid_content, "invalid.pdf")
        
        assert result.status == ProcessingStatus.FAILED
        assert len(result.errors) > 0
    
    def test_pattern_compilation(self, pdf_processor):
        """Test regex pattern compilation."""
        patterns = pdf_processor.patterns
        
        assert 'sample_name' in patterns
        assert 'submitter_email' in patterns
        assert 'concentration' in patterns
        
        # Test email pattern
        text = "Email: test@example.com"
        match = patterns['submitter_email'].search(text)
        assert match is not None
        assert match.group(1) == "test@example.com" 