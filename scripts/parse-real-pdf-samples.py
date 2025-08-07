#!/usr/bin/env python3
"""
Parse real HTSF PDF sample data with proper structure:
Sample Name, Volume (µL), Qubit Conc. (ng/µL), Nanodrop Conc. (ng/µL), A260/A280 ratio, A260/A230 ratio
"""

import sys
import json
import csv
from pathlib import Path

try:
    import PyPDF2
except ImportError:
    print("PyPDF2 not found. Installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
    import PyPDF2

def extract_real_samples_from_pdf(pdf_path):
    """Extract actual sample data from HTSF PDF"""
    samples = []
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            all_text = ''
            for page in pdf_reader.pages:
                all_text += page.extract_text() + '\n'
        
        lines = [line.strip() for line in all_text.split('\n') if line.strip()]
        
        # Find the sample data section
        sample_start_idx = None
        for i, line in enumerate(lines):
            if 'Sample Name' in line:
                # Look for the pattern where we have headers
                if i + 5 < len(lines) and 'Volume' in lines[i+1] and 'Qubit' in lines[i+2]:
                    sample_start_idx = i + 6  # Skip headers (Sample Name, Volume, Qubit, Nanodrop, A260/A280, A260/A230)
                    break
        
        if sample_start_idx is None:
            print("Could not find sample data section")
            return samples
        
        print(f"Found sample data starting at line {sample_start_idx}")
        
        # Parse samples - data appears to be in columns, each row has 6 values
        # Pattern: Sample Name, Volume, Qubit Conc, Nanodrop Conc, A260/A280, A260/A230
        current_sample = []
        sample_count = 0
        
        for i in range(sample_start_idx, len(lines)):
            line = lines[i].strip()
            
            # Skip empty lines
            if not line:
                continue
                
            # If we hit a section break or non-numeric/non-sample data, stop
            if any(keyword in line.lower() for keyword in ['service', 'total', 'summary', 'notes', 'comments']):
                break
            
            current_sample.append(line)
            
            # Every 6 elements make a complete sample
            if len(current_sample) == 6:
                try:
                    sample_name = current_sample[0]
                    volume = float(current_sample[1]) if current_sample[1].replace('.', '').isdigit() else 50.0
                    qubit_conc = float(current_sample[2]) if current_sample[2].replace('.', '').isdigit() else 0.0
                    nanodrop_conc = float(current_sample[3]) if current_sample[3].replace('.', '').isdigit() else 0.0
                    a260_280 = float(current_sample[4]) if current_sample[4].replace('.', '').isdigit() else 1.8
                    a260_230 = float(current_sample[5]) if current_sample[5].replace('.', '').isdigit() else 2.0
                    
                    sample = {
                        'sample_name': f'JL-147-{sample_name}' if sample_name.isdigit() else sample_name,
                        'sample_id': f'HTSF-{sample_name:0>3}' if sample_name.isdigit() else f'HTSF-{sample_count+1:03d}',
                        'volume': volume,
                        'volume_unit': 'μL',
                        'qubit_concentration': qubit_conc,
                        'nanodrop_concentration': nanodrop_conc,
                        'concentration': max(qubit_conc, nanodrop_conc),  # Use higher concentration
                        'concentration_unit': 'ng/μL',
                        'a260_280_ratio': a260_280,
                        'a260_230_ratio': a260_230,
                        'sample_type': 'DNA',
                        'priority': 'normal',
                        'status': 'submitted',
                        'lab_name': 'HTSF Lab',
                        'chart_field': 'HTSF-JL-147'
                    }
                    
                    samples.append(sample)
                    sample_count += 1
                    print(f"Parsed sample {sample_count}: {sample['sample_name']} - Volume: {volume}μL, Qubit: {qubit_conc}ng/μL, Nanodrop: {nanodrop_conc}ng/μL")
                    
                except (ValueError, TypeError) as e:
                    print(f"Error parsing sample data: {current_sample} - {e}")
                
                current_sample = []
                
                # Stop if we've found a reasonable number of samples
                if sample_count >= 100:
                    break
    
    except Exception as e:
        print(f"Error processing PDF: {e}")
    
    return samples

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 parse-real-pdf-samples.py <pdf_file>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(f"PDF file not found: {pdf_path}")
        sys.exit(1)
    
    print(f"Extracting real sample data from: {pdf_path}")
    samples = extract_real_samples_from_pdf(pdf_path)
    
    if not samples:
        print("No samples found in PDF")
        sys.exit(1)
    
    print(f"\nExtracted {len(samples)} samples")
    
    # Generate output files
    base_name = Path(pdf_path).stem
    json_file = f"{base_name}_real_samples.json"
    csv_file = f"{base_name}_real_samples.csv"
    
    # Save as JSON
    with open(json_file, 'w') as f:
        json.dump(samples, f, indent=2)
    print(f"Saved samples to: {json_file}")
    
    # Save as CSV
    if samples:
        with open(csv_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=samples[0].keys())
            writer.writeheader()
            writer.writerows(samples)
        print(f"Saved samples to: {csv_file}")
    
    # Show first few samples
    print(f"\nFirst 3 samples:")
    for i, sample in enumerate(samples[:3]):
        print(f"{i+1}. {sample['sample_name']}: Volume={sample['volume']}μL, Qubit={sample['qubit_concentration']}ng/μL, Nanodrop={sample['nanodrop_concentration']}ng/μL, A260/280={sample['a260_280_ratio']}, A260/230={sample['a260_230_ratio']}")

if __name__ == "__main__":
    main()
