import asyncio
import json
from tests.test_pdf_extraction import create_test_pdf
from app.services.pdf_processor import PDFProcessor


async def debug_extraction():
    """Debug what's being extracted from PDFs."""
    processor = PDFProcessor()
    
    # Test standard PDF
    print("=== Testing Standard PDF ===")
    pdf_content = create_test_pdf("standard")
    result = await processor.process_file(pdf_content, "test_standard.pdf")
    
    print(f"Status: {result.status}")
    print(f"Message: {result.message}")
    print(f"Number of samples: {len(result.data)}")
    
    if result.data:
        sample = result.data[0]
        print("\nExtracted fields:")
        # Convert to dict for easier viewing
        sample_dict = sample.dict() if hasattr(sample, 'dict') else sample.__dict__
        for field, value in sorted(sample_dict.items()):
            if value is not None:
                print(f"  {field}: {value}")
    
    print(f"\nMetadata: {json.dumps(result.metadata, indent=2)}")
    
    # Test realistic PDF
    print("\n\n=== Testing Realistic PDF ===")
    pdf_content = create_test_pdf("realistic")
    result = await processor.process_file(pdf_content, "test_realistic.pdf")
    
    print(f"Status: {result.status}")
    print(f"Message: {result.message}")
    
    if result.data:
        sample = result.data[0]
        sample_dict = sample.dict() if hasattr(sample, 'dict') else sample.__dict__
        print("\nExtracted fields:")
        for field, value in sorted(sample_dict.items()):
            if value is not None:
                print(f"  {field}: {value}")


if __name__ == "__main__":
    asyncio.run(debug_extraction()) 