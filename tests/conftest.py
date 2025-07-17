"""Pytest configuration and fixtures."""
import pytest
import asyncio
from typing import Generator
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def client() -> Generator:
    """Create a test client for the FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_pdf_content() -> bytes:
    """Sample PDF content for testing."""
    # This is a minimal valid PDF with sample data
    return b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
50 750 Td
(Sample Name: TEST-001) Tj
0 -20 Td
(Submitter Name: John Doe) Tj
0 -20 Td
(Email: john.doe@example.com) Tj
0 -20 Td
(Concentration: 50.5 ng/ul) Tj
0 -20 Td
(Volume: 30 ul) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
524
%%EOF"""


@pytest.fixture
def sample_csv_content() -> bytes:
    """Sample CSV content for testing."""
    return b"""sample_name,submitter_name,email,concentration,volume,organism,buffer
TEST-001,John Doe,john.doe@example.com,50.5,30,E. coli,TE Buffer
TEST-002,Jane Smith,jane.smith@example.com,75.2,25,Human,Water
TEST-003,Bob Johnson,bob@example.com,100,20,Mouse,PBS""" 