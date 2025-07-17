#!/usr/bin/env python3
"""
Demo script showing how the submission service processes HTSF quote PDFs
Uses the HTSF--JL-147_quote_160217072025.pdf as an example
"""

import json
from typing import Dict, Any, Optional

def parse_pdf_text_demo(text: str, page_num: int) -> Optional[Dict[str, Any]]:
    """
    Demo version of the PDF parser for HTSF quote forms
    This shows the expected data extraction from the provided template
    """
    import re
    
    # Sample text that would be extracted from HTSF--JL-147_quote_160217072025.pdf
    sample_text = """
    University of North Carolina at Chapel Hill
    High Throughput Sequencing Facility
    
    Quote for HTSF--JL-147 as of July 17, 2025
    
    Quote:
    Summary
    Request Summary:
    
    Forms
    HTSF Nanopore Submission Form DNA
    
    I will be submitting DNA for:
    □ Whole genome sequencing
    ☑ Targeted sequencing
    □ Metagenomics
    
    Type of Sample
    ☑ Genomic DNA
    □ Amplicon/PCR product
    □ Other
    
    Source Organism: Human
    
    Sample Buffer: TE Buffer
    
    Sample Information:
    Sample Name    Concentration    Volume    260/280    260/230
    JL-147-001     150.5 ng/μL     50 μL     1.85       2.10
    
    Flow Cell Selection:
    ☑ R10.4.1 (latest chemistry, recommended)
    □ R9.4.1 (legacy)
    
    Device: PromethION
    
    Bioinformatics and Data Delivery
    ☑ Basecalling (included)
    ☑ Quality metrics report
    □ De novo assembly
    □ Variant calling
    
    Data delivery via Globus endpoint
    
    Projected Cost: $897.00
    Known Charges: $897.00
    
    Contact: Jane Lab
    Email: jlab@email.unc.edu
    PI: Dr. Jane Smith
    Department: Genetics
    """
    
    # Parse using the same logic as the actual parser
    lines = text.split('\n') if text else sample_text.split('\n')
    sample_data = {}
    
    # Initialize with defaults
    sample_data['status'] = 'pending'
    sample_data['priority'] = 'normal'
    
    # Extract HTSF Quote ID
    htsf_pattern = r'(HTSF--[A-Z]+-\d+)'
    for line in lines:
        match = re.search(htsf_pattern, line)
        if match:
            sample_data['chart'] = match.group(1)
            sample_data['sample_name'] = match.group(1)
            break
    
    # Parse sections
    current_section = None
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Identify sections
        if 'Sample Information' in line:
            current_section = 'sample_info'
        elif 'Flow Cell Selection' in line:
            current_section = 'flow_cell'
        elif 'Source Organism' in line:
            current_section = 'organism'
        elif 'Type of Sample' in line:
            current_section = 'sample_type'
        
        # Extract sample information
        if current_section == 'sample_info' and i + 1 < len(lines):
            # Look for the data row after headers
            if 'Sample Name' in line and 'Concentration' in line:
                # Next line should contain the actual data
                if i + 1 < len(lines):
                    data_line = lines[i + 1].strip()
                    if data_line and not 'Sample Name' in data_line:
                        # Parse: JL-147-001     150.5 ng/μL     50 μL     1.85       2.10
                        parts = data_line.split()
                        if len(parts) >= 3:
                            sample_data['sample_name'] = parts[0]
                            
                            # Extract concentration
                            for j, part in enumerate(parts):
                                if 'ng/' in part:
                                    # Previous part should be the number
                                    if j > 0:
                                        try:
                                            sample_data['concentration'] = float(parts[j-1])
                                        except:
                                            pass
                            
                            # Extract volume
                            for j, part in enumerate(parts):
                                if 'μL' in part or 'ul' in part.lower():
                                    # Previous part should be the number
                                    if j > 0:
                                        try:
                                            sample_data['volume'] = float(parts[j-1])
                                        except:
                                            pass
        
        # Extract flow cell type
        elif current_section == 'flow_cell':
            if '☑' in line or 'R10.4.1' in line:
                if 'R10.4.1' in line:
                    sample_data['flow_cell_type'] = 'R10.4.1'
            elif 'PromethION' in line:
                sample_data['device_type'] = 'PromethION'
        
        # Extract organism
        elif current_section == 'organism':
            if ':' in line:
                organism = line.split(':', 1)[1].strip()
                if organism:
                    sample_data['organism'] = organism
        
        # Extract sample type
        elif current_section == 'sample_type':
            if '☑' in line:
                if 'Genomic DNA' in line:
                    sample_data['sample_type'] = 'DNA'
                    sample_data['dna_type'] = 'Genomic DNA'
        
        # Extract contact information
        if 'Contact:' in line:
            contact = line.split(':', 1)[1].strip()
            if contact:
                sample_data['submitter_name'] = contact
        elif 'Email:' in line:
            email = line.split(':', 1)[1].strip()
            if email:
                sample_data['submitter_email'] = email
        elif 'PI:' in line:
            pi = line.split(':', 1)[1].strip()
            if pi:
                sample_data['principal_investigator'] = pi
        elif 'Department:' in line:
            dept = line.split(':', 1)[1].strip()
            if dept:
                sample_data['department'] = dept
        
        # Extract cost
        if 'Projected Cost:' in line or 'Known Charges:' in line:
            cost_match = re.search(r'\$\s*([\d,]+\.?\d*)', line)
            if cost_match:
                sample_data['estimated_cost'] = float(cost_match.group(1).replace(',', ''))
        
        i += 1
    
    # Add metadata
    sample_data['pdf_page'] = page_num
    sample_data['extraction_method'] = 'pdf_htsf_quote'
    sample_data['form_type'] = 'HTSF Nanopore Submission Form'
    
    return sample_data

def demonstrate_pdf_processing():
    """
    Demonstrate how the PDF processor extracts data from HTSF quote forms
    """
    print("=== HTSF Quote PDF Processing Demo ===\n")
    
    # Process the sample PDF text
    extracted_data = parse_pdf_text_demo("", 1)
    
    if extracted_data:
        print("Successfully extracted the following data from HTSF quote form:\n")
        print(json.dumps(extracted_data, indent=2))
        
        print("\n=== Key Fields Extracted ===")
        print(f"Quote ID: {extracted_data.get('chart', 'Not found')}")
        print(f"Sample Name: {extracted_data.get('sample_name', 'Not found')}")
        print(f"Concentration: {extracted_data.get('concentration', 0)} ng/μL")
        print(f"Volume: {extracted_data.get('volume', 0)} μL")
        print(f"Sample Type: {extracted_data.get('sample_type', 'Not found')}")
        print(f"Organism: {extracted_data.get('organism', 'Not found')}")
        print(f"Flow Cell: {extracted_data.get('flow_cell_type', 'Not found')}")
        print(f"Submitter: {extracted_data.get('submitter_name', 'Not found')}")
        print(f"Email: {extracted_data.get('submitter_email', 'Not found')}")
        print(f"Estimated Cost: ${extracted_data.get('estimated_cost', 0):.2f}")
        
        print("\n=== API Call to Create Sample ===")
        api_payload = {
            "sample_name": extracted_data.get('sample_name'),
            "sample_type": extracted_data.get('sample_type'),
            "concentration": extracted_data.get('concentration'),
            "volume": extracted_data.get('volume'),
            "submitter_name": extracted_data.get('submitter_name'),
            "submitter_email": extracted_data.get('submitter_email'),
            "chart": extracted_data.get('chart'),
            "organism": extracted_data.get('organism'),
            "flow_cell_type": extracted_data.get('flow_cell_type'),
            "status": "pending",
            "priority": "normal"
        }
        
        print("POST /api/nanopore/samples")
        print("Content-Type: application/json")
        print(f"\n{json.dumps(api_payload, indent=2)}")
        
    else:
        print("Failed to extract data from PDF")

if __name__ == "__main__":
    demonstrate_pdf_processing() 