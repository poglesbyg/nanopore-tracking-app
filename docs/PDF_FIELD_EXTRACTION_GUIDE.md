# PDF Field Extraction and Storage Guide

## Overview

The nanopore tracking system extracts comprehensive information from HTSF PDF forms and stores them in the database for each sample and submission.

## Extracted Fields

### Sample-Level Fields

These fields are extracted and stored with each sample:

| PDF Field | Extraction Pattern | Database Column | Example Value |
|-----------|-------------------|-----------------|---------------|
| Flow Cell Selection | `(MinION\|PromethION) Flow Cell` | `flow_cell_type` | "MinION" |
| Estimated Flow Cells | `Estimated number of Flow Cells (\d+)` | `flow_cell_count` | 1 |
| Approx. Genome Size | `Approx. Genome Size (\d+)` | `genome_size` | "600" |
| Approx. Coverage Needed | `Approx. Coverage Needed (\d+x?-?\d*x?)` | `target_coverage` | "50x-100x" |
| Basecalling Model | `basecalled using:.*?(HAC\|SUP)` | `basecalling_model` | "HAC" |
| Data Delivery Method | `How would you like to retrieve...` | `delivery_method` | "Deliver my data to ITS..." |
| Projected Cost | `Projected Cost: \$?([\d,]+\.?\d*)` | `estimated_cost` | 897.00 |

### Metadata Fields

These fields are stored in the sample metadata JSON:

| PDF Field | Extraction Pattern | Metadata Key | Example Value |
|-----------|-------------------|--------------|---------------|
| File Format | `File Format:.*?(FASTQ / BAM\|POD5)` | `fileFormat` | "FASTQ / BAM" |
| Delivery Email | `Data Delivery Notification email addresses: (.+)` | `deliveryEmail` | "joshleon@unc.edu" |
| Special Instructions | `Additional Comments / Special Needs (.+)` | `specialInstructions` | "Amplicon length is 600 bp..." |

### Submission-Level Fields

These are stored with the submission record:

- `pdf_filename`: Name of the uploaded PDF
- `submitter_name`: Extracted from form
- `submitter_email`: Extracted from form
- `lab_name`: Extracted from form
- `billing_account`: Chart field or quote identifier
- `sample_count`: Total samples in submission
- `pdf_metadata`: Complete extraction metadata

## Field Mapping

### Frontend Processing (`src/pages/api/submission/process-pdf.ts`)

```typescript
const baseSampleData = {
  // Core fields
  submitterName: extractedData.submitter_name,
  submitterEmail: extractedData.submitter_email,
  sampleType: extractedData.sample_type,
  
  // Additional extracted fields
  flowCellType: extractedData.flow_cell,
  flowCellCount: extractedData.flow_cell_count || 1,
  genomeSize: extractedData.genome_size,
  targetCoverage: extractedData.coverage,
  basecallingModel: extractedData.basecalling,
  deliveryMethod: extractedData.data_delivery,
  estimatedCost: parseFloat(extractedData.cost),
  
  // Metadata
  metadata: {
    fileFormat: extractedData.file_format,
    deliveryEmail: extractedData.delivery_email,
    specialInstructions: extractedData.special_instructions,
    ...extractedData.metadata
  }
}
```

### Python Extraction (`services/submission-service/app/services/pdf_processor.py`)

The PDF processor uses regex patterns to extract fields from the PDF text:

```python
patterns = {
    'flow_cell': re.compile(r'Flow\s*Cell\s*Selection[:\s]*\n?\s*(MinION|PromethION)\s*Flow\s*Cell'),
    'genome_size': re.compile(r'Approx\.\s*Genome\s*Size\s+(\d+(?:\.\d+)?)'),
    'coverage': re.compile(r'Approx\.\s*Coverage\s*Needed\s+(\d+x?-?\d*x?)'),
    'cost': re.compile(r'Projected\s*Cost[:\s]*\$?([\d,]+\.?\d*)'),
    'basecalling': re.compile(r'basecalled\s*using[:\s]*\n\s*(HAC|SUP)\s*\([^)]+\)'),
    'file_format': re.compile(r'File\s*Format[:\s]*\n\s*(FASTQ\s*/\s*BAM|POD5)[^\n]*'),
    'data_delivery': re.compile(r'How\s*would\s*you\s*like\s*to\s*retrieve.*?\n\s*(Deliver\s*my\s*data\s*to\s*ITS|Provide\s*me\s*with\s*a\s*URL|Pre-arranged|Other)[^\n]*'),
    'delivery_email': re.compile(r'Data\s*Delivery\s*Notification\s*email\s*addresses[:\s]*\n?\s*([^\n]+)'),
    'flow_cell_count': re.compile(r'Estimated\s*number\s*of\s*Flow\s*Cells\s+(\d+)'),
    'special_instructions': re.compile(r'(?:Additional\s*Comments?\s*/?\s*Special\s*Needs?)[:\s]*\n?\s*([^$]+?)(?=\n\n|\nBioinformatics|$)')
}
```

## Example Extracted Data

From a typical HTSF PDF:

```json
{
  "flow_cell": "MinION",
  "flow_cell_count": 1,
  "genome_size": "600",
  "coverage": "50x-100x",
  "cost": "897.00",
  "basecalling": "HAC",
  "file_format": "FASTQ / BAM",
  "data_delivery": "Deliver my data to ITS Research Computing storage (/proj)",
  "delivery_email": "joshleon@unc.edu",
  "special_instructions": "Amplicon length is 600 bp. Genome size is difficult to approximate as these are microbiome samples. For coverage, I am hoping to get anywhere between 30,000 - 100,000 reads per sample."
}
```

## Usage

When a PDF is uploaded:

1. The Python submission service extracts all fields using regex patterns
2. The frontend API receives the extracted data
3. Fields are mapped to database columns
4. Additional fields are stored in the metadata JSON
5. Each sample inherits these values from the submission

This ensures that all relevant information from the PDF is captured and available for tracking, reporting, and workflow management. 