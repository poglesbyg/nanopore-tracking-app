#!/usr/bin/env python3
"""
Correctly parse HTSF PDF sample data with proper column alignment:
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

def extract_htsf_samples_correctly(pdf_path):
    """Extract actual sample data from HTSF PDF with correct column alignment"""
    samples = []
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            all_text = ''
            for page in pdf_reader.pages:
                all_text += page.extract_text() + '\n'
        
        lines = [line.strip() for line in all_text.split('\n') if line.strip()]
        
        # Find the sample data section - look for "Sample Information:"
        sample_start_idx = None
        for i, line in enumerate(lines):
            if 'Sample Information:' in line:
                # Skip the headers (Sample Name, Volume, Qubit, Nanodrop, A260/A280, A260/A230)
                # Look for where the actual data starts (first numeric value)
                for j in range(i + 1, min(i + 20, len(lines))):
                    if lines[j].isdigit():
                        sample_start_idx = j
                        break
                break
        
        if sample_start_idx is None:
            print("Could not find sample data section")
            return samples
        
        print(f"Found sample data starting at line {sample_start_idx}: '{lines[sample_start_idx]}'")
        
        # Parse samples - each sample has exactly 6 values in this order:
        # 1. Sample number (1, 2, 3, etc.)
        # 2. Volume (µL) 
        # 3. Qubit Concentration (ng/µL)
        # 4. Nanodrop Concentration (ng/µL) 
        # 5. A260/A280 ratio
        # 6. A260/A230 ratio
        
        sample_data = []
        for i in range(sample_start_idx, len(lines)):
            line = lines[i].strip()
            
            # Skip empty lines
            if not line:
                continue
                
            # Stop if we hit non-sample data
            if any(keyword in line.lower() for keyword in ['service', 'total', 'summary', 'notes', 'comments', 'promethion']):
                break
                
            # Check if this looks like sample data (numeric or reasonable sample name)
            if line.replace('.', '').isdigit() or (len(line) < 10 and any(c.isdigit() for c in line)):
                sample_data.append(line)
        
        print(f"Collected {len(sample_data)} data points")
        
        # Group into samples of 6 values each
        for i in range(0, len(sample_data), 6):
            if i + 5 < len(sample_data):  # Make sure we have all 6 values
                try:
                    sample_num = sample_data[i]
                    volume = float(sample_data[i + 1])
                    qubit_conc = float(sample_data[i + 2])
                    nanodrop_conc = float(sample_data[i + 3])
                    a260_280 = float(sample_data[i + 4])
                    a260_230 = float(sample_data[i + 5])
                    
                    sample = {
                        'sample_name': f'JL-147-{sample_num:0>3}',
                        'sample_id': f'HTSF-{sample_num:0>3}',
                        'sample_number': int(sample_num) if sample_num.isdigit() else len(samples) + 1,
                        'volume': volume,
                        'volume_unit': 'μL',
                        'qubit_concentration': qubit_conc,
                        'nanodrop_concentration': nanodrop_conc,
                        'concentration': max(qubit_conc, nanodrop_conc) if qubit_conc > 0 else nanodrop_conc,
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
                    print(f"Sample {len(samples)}: {sample['sample_name']} - Vol: {volume}μL, Qubit: {qubit_conc}ng/μL, Nanodrop: {nanodrop_conc}ng/μL, A260/280: {a260_280}, A260/230: {a260_230}")
                    
                except (ValueError, TypeError) as e:
                    print(f"Error parsing sample {i//6 + 1}: {sample_data[i:i+6]} - {e}")
                    continue
    
    except Exception as e:
        print(f"Error processing PDF: {e}")
    
    return samples

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 parse-htsf-samples-correct.py <pdf_file>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(f"PDF file not found: {pdf_path}")
        sys.exit(1)
    
    print(f"Extracting HTSF sample data from: {pdf_path}")
    samples = extract_htsf_samples_correctly(pdf_path)
    
    if not samples:
        print("No samples found in PDF")
        sys.exit(1)
    
    print(f"\nSuccessfully extracted {len(samples)} samples")
    
    # Generate output files
    base_name = Path(pdf_path).stem
    json_file = f"{base_name}_correct_samples.json"
    csv_file = f"{base_name}_correct_samples.csv"
    
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
    
    # Show summary and first few samples
    print(f"\n=== SAMPLE SUMMARY ===")
    print(f"Total samples: {len(samples)}")
    print(f"Volume range: {min(s['volume'] for s in samples)}-{max(s['volume'] for s in samples)} μL")
    print(f"Qubit range: {min(s['qubit_concentration'] for s in samples)}-{max(s['qubit_concentration'] for s in samples)} ng/μL")
    print(f"Nanodrop range: {min(s['nanodrop_concentration'] for s in samples)}-{max(s['nanodrop_concentration'] for s in samples)} ng/μL")
    
    print(f"\n=== FIRST 5 SAMPLES ===")
    for i, sample in enumerate(samples[:5]):
        print(f"{i+1}. {sample['sample_name']}")
        print(f"   Volume: {sample['volume']} μL")
        print(f"   Qubit: {sample['qubit_concentration']} ng/μL")
        print(f"   Nanodrop: {sample['nanodrop_concentration']} ng/μL") 
        print(f"   A260/280: {sample['a260_280_ratio']}")
        print(f"   A260/230: {sample['a260_230_ratio']}")
        print()

if __name__ == "__main__":
    main()
