"""Unit tests for data models."""
import pytest
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.models.schemas import (
    ProcessingStatus, FileType, SampleData, 
    ProcessingResult, HealthResponse
)


class TestModels:
    """Test data models and schemas."""
    
    def test_sample_data_validation(self):
        """Test SampleData model validation."""
        # Valid data
        sample = SampleData(
            sample_name="TEST-001",
            submitter_name="John Doe",
            submitter_email="john@example.com",
            concentration=50.5,
            volume=30.0
        )
        assert sample.sample_name == "TEST-001"
        assert sample.concentration == 50.5
        
        # Test negative concentration validation
        with pytest.raises(ValueError):
            SampleData(
                sample_name="TEST-002",
                submitter_name="Jane Doe",
                submitter_email="jane@example.com",
                concentration=-10.0
            )
    
    def test_processing_result(self):
        """Test ProcessingResult model."""
        result = ProcessingResult(
            status=ProcessingStatus.COMPLETED,
            message="Success",
            data=[],
            processing_time=1.5
        )
        assert result.status == ProcessingStatus.COMPLETED
        assert result.processing_time == 1.5
        assert len(result.errors) == 0
    
    def test_health_response(self):
        """Test HealthResponse model."""
        health = HealthResponse(
            environment="test",
            memory_usage_mb=100.5,
            cpu_percent=25.0
        )
        assert health.status == "healthy"
        assert health.environment == "test"
        assert isinstance(health.timestamp, datetime) 