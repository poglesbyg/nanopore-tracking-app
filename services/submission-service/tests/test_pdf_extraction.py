import asyncio
import pytest
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import PyPDF2

from app.services.pdf_processor import PDFProcessor
from app.models.schemas import ProcessingStatus


def create_test_pdf(content_type="standard"):
    """Create test PDFs with different content types."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    if content_type == "standard":
        # Standard HTSF submission form
        c.setFont("Helvetica-Bold", 16)
        c.drawString(1*inch, 10*inch, "HTSF Nanopore Sequencing Service Request")
        
        c.setFont("Helvetica", 12)
        y_position = 9*inch
        
        # Sample information
        c.drawString(1*inch, y_position, "Sample Name: SAMPLE-001")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Type of Sample: DNA")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Organism: E. coli")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Concentration: 150 ng/ul")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Volume: 50 ul")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Buffer: TE Buffer")
        
        # Submitter information - Fixed format
        y_position -= 0.5*inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1*inch, y_position, "Contact Information")
        c.setFont("Helvetica", 12)
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Contact: Dr. Jane Smith")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Email: jane.smith@university.edu")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Lab: Smith Lab")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Phone: 919-555-1234")
        
        # Sequencing details
        y_position -= 0.5*inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1*inch, y_position, "Sequencing Details")
        c.setFont("Helvetica", 12)
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Flow Cell: FLO-MIN106")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Genome Size: 4.6 Mb")
        y_position -= 0.3*inch
        c.drawString(1*inch, y_position, "Coverage: 100x")
        
    elif content_type == "minimal":
        # Minimal information
        c.setFont("Helvetica", 12)
        c.drawString(1*inch, 10*inch, "Sample ID: TEST-MIN-001")
        c.drawString(1*inch, 9.5*inch, "Email: test@email.com")
        
    elif content_type == "complex":
        # Complex format with tables
        c.setFont("Helvetica-Bold", 14)
        c.drawString(1*inch, 10*inch, "Nanopore Sequencing Request Form")
        
        c.setFont("Helvetica", 10)
        y_position = 9*inch
        
        # Table-like structure
        c.drawString(1*inch, y_position, "Sample Information:")
        y_position -= 0.2*inch
        c.drawString(1.5*inch, y_position, "Sample Name:")
        c.drawString(3.5*inch, y_position, "COMPLEX-001")
        y_position -= 0.2*inch
        c.drawString(1.5*inch, y_position, "Type of Sample:")
        c.drawString(3.5*inch, y_position, "RNA")
        y_position -= 0.2*inch
        c.drawString(1.5*inch, y_position, "Concentration:")
        c.drawString(3.5*inch, y_position, "75.5 ng/μl")
        y_position -= 0.2*inch
        c.drawString(1.5*inch, y_position, "Volume:")
        c.drawString(3.5*inch, y_position, "25 μl")
        
        y_position -= 0.4*inch
        c.drawString(1*inch, y_position, "Requester Details:")
        y_position -= 0.2*inch
        c.drawString(1.5*inch, y_position, "Requester:")
        c.drawString(3.5*inch, y_position, "Prof. John Doe")
        y_position -= 0.2*inch
        c.drawString(1.5*inch, y_position, "E-mail:")
        c.drawString(3.5*inch, y_position, "john.doe@institution.org")
        
    elif content_type == "realistic":
        # More realistic HTSF format
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2*inch, 10*inch, "High-Throughput Sequencing Facility")
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2.5*inch, 9.7*inch, "Nanopore Sequencing Quote")
        
        c.setFont("Helvetica", 10)
        y_position = 9*inch
        
        # Quote details
        c.drawString(1*inch, y_position, "Quote Identifier: HTSF-2024-001")
        y_position -= 0.25*inch
        c.drawString(1*inch, y_position, "Date: January 24, 2025")
        
        # Sample details section
        y_position -= 0.5*inch
        c.setFont("Helvetica-Bold", 11)
        c.drawString(1*inch, y_position, "Sample Details")
        c.setFont("Helvetica", 10)
        y_position -= 0.25*inch
        
        # Create a table-like structure
        c.drawString(1*inch, y_position, "Sample Name: HTSF-SAMPLE-001")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Sample Type: Genomic DNA")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Species/Organism: Escherichia coli K-12")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Concentration: 150 ng/ul (measured by Qubit)")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Volume: 50 ul")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Buffer: TE buffer (10 mM Tris, 1 mM EDTA, pH 8.0)")
        
        # Submitter section
        y_position -= 0.4*inch
        c.setFont("Helvetica-Bold", 11)
        c.drawString(1*inch, y_position, "Submitter Information")
        c.setFont("Helvetica", 10)
        y_position -= 0.25*inch
        
        c.drawString(1*inch, y_position, "Submitter: Dr. Jane Smith")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Email: jane.smith@university.edu")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Phone: (919) 555-1234")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Lab: Smith Laboratory, Department of Biology")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "PI Name: Prof. John Smith")
        
        # Service details
        y_position -= 0.4*inch
        c.setFont("Helvetica-Bold", 11)
        c.drawString(1*inch, y_position, "Service Requested")
        c.setFont("Helvetica", 10)
        y_position -= 0.25*inch
        
        c.drawString(1*inch, y_position, "Service Type: Whole Genome Sequencing")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Flow Cell Type: FLO-MIN106 (R9.4.1)")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Approx. Genome Size: 4.6 Mb")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Approx. Coverage: 100x")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "Basecalling: High accuracy basecalling using Guppy 6.0")
        y_position -= 0.2*inch
        c.drawString(1*inch, y_position, "File Format: FASTQ")
        
        # Cost section
        y_position -= 0.4*inch
        c.setFont("Helvetica-Bold", 11)
        c.drawString(1*inch, y_position, "Cost Estimate")
        c.setFont("Helvetica", 10)
        y_position -= 0.25*inch
        c.drawString(1*inch, y_position, "Projected Cost: $450.00")
        
    elif content_type == "empty":
        # Empty PDF
        c.drawString(1*inch, 10*inch, " ")
        
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_standard_pdf_extraction():
    """Test extraction from standard format PDF."""
    processor = PDFProcessor()
    pdf_content = create_test_pdf("standard")
    
    result = await processor.process_file(pdf_content, "test_standard.pdf")
    
    assert result.status == ProcessingStatus.COMPLETED
    assert len(result.data) > 0
    
    sample = result.data[0]
    assert sample.sample_name == "SAMPLE-001"
    assert sample.submitter_name == "Dr. Jane Smith"
    assert sample.submitter_email == "jane.smith@university.edu"
    assert sample.organism == "E. coli"
    assert sample.concentration == 150.0
    assert sample.volume == 50.0


@pytest.mark.asyncio
async def test_realistic_pdf_extraction():
    """Test extraction from realistic HTSF format PDF."""
    processor = PDFProcessor()
    pdf_content = create_test_pdf("realistic")
    
    result = await processor.process_file(pdf_content, "test_realistic.pdf")
    
    assert result.status == ProcessingStatus.COMPLETED
    assert len(result.data) > 0
    
    sample = result.data[0]
    assert sample.sample_name == "HTSF-SAMPLE-001"
    assert "Jane Smith" in sample.submitter_name
    assert sample.submitter_email == "jane.smith@university.edu"
    assert "coli" in sample.organism
    assert sample.concentration == 150.0
    assert sample.volume == 50.0
    assert sample.quote_identifier == "HTSF-2024-001"
    assert sample.flow_cell == "FLO-MIN106 (R9.4.1)"


@pytest.mark.asyncio
async def test_minimal_pdf_extraction():
    """Test extraction from minimal PDF."""
    processor = PDFProcessor()
    pdf_content = create_test_pdf("minimal")
    
    result = await processor.process_file(pdf_content, "test_minimal.pdf")
    
    assert result.status == ProcessingStatus.COMPLETED
    # Should extract what it can
    if result.data:
        sample = result.data[0]
        assert sample.sample_name == "TEST-MIN-001"
        assert sample.submitter_email == "test@email.com"


@pytest.mark.asyncio
async def test_complex_pdf_extraction():
    """Test extraction from complex format PDF."""
    processor = PDFProcessor()
    pdf_content = create_test_pdf("complex")
    
    result = await processor.process_file(pdf_content, "test_complex.pdf")
    
    assert result.status == ProcessingStatus.COMPLETED
    assert len(result.data) == 1
    
    sample = result.data[0]
    assert sample.sample_name == "COMPLEX-001"
    assert sample.sample_type == "RNA"
    assert sample.submitter_name == "Prof. John Doe"
    assert sample.submitter_email == "john.doe@institution.org"
    assert sample.concentration == 75.5
    assert sample.volume == 25.0


@pytest.mark.asyncio
async def test_empty_pdf():
    """Test handling of empty PDF."""
    processor = PDFProcessor()
    pdf_content = create_test_pdf("empty")
    
    result = await processor.process_file(pdf_content, "test_empty.pdf")
    
    assert result.status == ProcessingStatus.COMPLETED
    assert result.message == "PDF processed but no sample data found"
    assert len(result.data) == 0


@pytest.mark.asyncio
async def test_pattern_matching():
    """Test individual pattern matching."""
    processor = PDFProcessor()
    
    # Test sample name patterns
    test_texts = [
        ("Sample Name: TEST-001", "TEST-001"),
        ("Sample ID: TEST-002", "TEST-002"),
        ("sample name:TEST-003", "TEST-003"),
    ]
    
    for text, expected in test_texts:
        match = processor.patterns['sample_name'].search(text)
        assert match is not None
        assert match.group(1).strip() == expected


@pytest.mark.asyncio
async def test_numeric_extraction():
    """Test extraction of numeric values."""
    processor = PDFProcessor()
    
    # Test concentration patterns
    concentration_tests = [
        ("Concentration: 150 ng/ul", 150.0),
        ("Concentration: 75.5 ng/μl", 75.5),
        ("concentration:200ng/ul", 200.0),
    ]
    
    for text, expected in concentration_tests:
        match = processor.patterns['concentration'].search(text)
        assert match is not None
        value = float(match.group(1))
        assert value == expected


def test_create_sample_pdf_for_manual_testing():
    """Create a sample PDF file for manual testing."""
    # Create all variants
    for variant in ["standard", "minimal", "complex", "realistic"]:
        pdf_content = create_test_pdf(variant)
        filename = f"sample_submission_{variant}.pdf" if variant != "standard" else "sample_submission.pdf"
        with open(filename, "wb") as f:
            f.write(pdf_content)
        print(f"Created {filename}")


if __name__ == "__main__":
    # Run this to create sample PDFs
    test_create_sample_pdf_for_manual_testing()
    
    # Run basic tests
    asyncio.run(test_standard_pdf_extraction())
    asyncio.run(test_minimal_pdf_extraction())
    asyncio.run(test_complex_pdf_extraction())
    asyncio.run(test_realistic_pdf_extraction())
    print("All tests passed!") 