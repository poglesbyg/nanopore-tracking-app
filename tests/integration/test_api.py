"""Integration tests for API endpoints."""
import pytest
from io import BytesIO
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


class TestAPI:
    """Test API endpoints."""
    
    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "memory_usage_mb" in data
        assert "cpu_percent" in data
        assert "timestamp" in data
    
    def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        
        data = response.json()
        assert data["service"] == "Nanopore Submission Service"
        assert "version" in data
    
    def test_api_root_endpoint(self, client):
        """Test API root endpoint."""
        response = client.get("/api/v1/")
        assert response.status_code == 200
        
        data = response.json()
        assert "endpoints" in data
        assert "health" in data["endpoints"]
        assert "process_pdf" in data["endpoints"]
        assert "process_csv" in data["endpoints"]
    
    def test_process_pdf_endpoint(self, client, sample_pdf_content):
        """Test PDF processing endpoint."""
        files = {"file": ("test.pdf", BytesIO(sample_pdf_content), "application/pdf")}
        response = client.post("/api/v1/process-pdf", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert len(data["data"]) == 1
        assert data["data"][0]["sample_name"] == "TEST-001"
    
    def test_process_pdf_invalid_type(self, client):
        """Test PDF endpoint with wrong file type."""
        files = {"file": ("test.txt", BytesIO(b"not a pdf"), "text/plain")}
        response = client.post("/api/v1/process-pdf", files=files)
        
        assert response.status_code == 400
        assert "must be a PDF" in response.json()["detail"]
    
    def test_process_csv_endpoint(self, client, sample_csv_content):
        """Test CSV processing endpoint."""
        files = {"file": ("test.csv", BytesIO(sample_csv_content), "text/csv")}
        response = client.post("/api/v1/process-csv", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert len(data["data"]) == 3
        assert data["data"][0]["sample_name"] == "TEST-001"
    
    def test_process_csv_invalid_type(self, client):
        """Test CSV endpoint with wrong file type."""
        files = {"file": ("test.txt", BytesIO(b"not a csv"), "text/plain")}
        response = client.post("/api/v1/process-csv", files=files)
        
        assert response.status_code == 400
        assert "must be a CSV" in response.json()["detail"] 