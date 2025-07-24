# PDF Extraction Improvements

## Overview

The PDF extraction logic has been improved to handle real-world HTSF PDFs more accurately by filtering out header rows and invalid data.

## Key Improvements

### 1. Header Row Filtering
The system now automatically skips table entries that appear to be headers by checking for:
- "ratio" (often appears in column headers)
- Text containing "µl" or "ng/µl" (measurement units in headers)
- Text containing both "sample" and "name"

### 2. Sample Creation Strategy
- **No Primary Sample**: Removed creation of a primary sample from the badly extracted `sample_name` field
- **Table-Only Processing**: Samples are created exclusively from the `sample_table` array
- **Sequential Numbering**: Samples are numbered 1, 2, 3... regardless of gaps in the source data

### 3. Single Sample Support
For PDFs without a sample table:
- Creates a single sample if `sample_name` exists
- Validates that the name doesn't look like header text
- Uses extracted concentration and volume data

## Results

### Before Improvements
- HTSF PDF created 44 samples
- First sample: "Volume (µL) Qubit Conc. (ng/µL)..." (header text)
- Second sample: "ratio" (header fragment)
- Actual samples started at position 3

### After Improvements
- HTSF PDF creates 42 samples (correct count)
- First sample: "2" (actual first sample)
- Last sample: "43" (actual last sample)
- Clean, sequential numbering

## Example Output

```
#  Sample Name  Type                              Conc.       Vol.      Status
1  2            High Molecular Weight DNA / gDNA  2.000 ng/μL 3.00 μL   submitted
2  3            High Molecular Weight DNA / gDNA  2.000 ng/μL 5.00 μL   submitted
3  4            High Molecular Weight DNA / gDNA  2.000 ng/μL 6.00 μL   submitted
...
42 43           High Molecular Weight DNA / gDNA  2.000 ng/μL 91.00 μL  submitted
```

## Technical Implementation

The filtering logic is implemented in `/src/pages/api/submission/process-pdf.ts`:

```typescript
// Skip entries that look like header data
const sampleName = tableSample.sample_name || ''
if (sampleName.toLowerCase() === 'ratio' || 
    sampleName.toLowerCase().includes('sample') && sampleName.toLowerCase().includes('name') ||
    sampleName.toLowerCase().includes('µl') ||
    sampleName.toLowerCase().includes('ng/µl')) {
  continue
}
```

This ensures that only valid sample data is processed and stored in the database. 