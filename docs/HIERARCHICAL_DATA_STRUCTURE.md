# Hierarchical Data Structure - PDF Submissions & Samples

## Overview

The nanopore tracking system now uses a hierarchical data structure where:
- Each PDF upload creates a **submission** record
- All samples extracted from that PDF are linked to the submission
- This provides complete traceability from PDF to individual samples

## Database Structure

### nanopore_submissions Table
- **Primary container** for each PDF upload
- Stores metadata about the submission:
  - PDF filename
  - Submitter information (name, email, lab)
  - Submission date and status
  - Sample count
  - Extracted data from PDF
  - Processing metadata

### nanopore_samples Table
- **Child records** linked to submissions via `submission_id`
- Each sample has a `sample_number` within its submission
- Complete sample details (concentration, volume, type, etc.)

## Workflow

1. **PDF Upload**
   - User uploads PDF via `/submit-pdf`
   - System extracts data using pattern matching

2. **Submission Creation**
   - Creates a `nanopore_submissions` record
   - Status: `processing`
   - Stores all extracted data

3. **Sample Creation**
   - Creates individual sample records
   - Links each to the submission via `submission_id`
   - Numbers samples sequentially (1, 2, 3...)

4. **Completion**
   - Updates submission status to `completed`
   - Records final sample count

## API Endpoints

### POST /api/submission/process-pdf
- Accepts PDF file upload
- Creates submission and samples
- Returns:
  ```json
  {
    "success": true,
    "samples_created": 44,
    "submissionId": "3db55961-e871-4221-b099-d6c48d377776",
    "message": "Successfully processed PDF"
  }
  ```

### GET /api/submissions/get-all
- Fetches all submissions with their samples
- Returns hierarchical data:
  ```json
  {
    "success": true,
    "data": [{
      "id": "3db55961-e871-4221-b099-d6c48d377776",
      "submission_number": "SUBM-20250724-123227-8d6269f8",
      "pdf_filename": "HTSF--JL-147_quote_160217072025.pdf",
      "sample_count": 44,
      "samples": [
        {
          "id": "...",
          "sample_name": "Sample 1",
          "sample_number": 1,
          ...
        }
      ]
    }]
  }
  ```

## UI Components

### HierarchicalSubmissions Component
- Displays submissions as expandable cards
- Shows submission metadata in header
- Lists all samples in a table when expanded
- Features:
  - Automatic expansion for submissions with samples
  - Color-coded status badges
  - Sample count display
  - Detailed sample information table

## Benefits

1. **Traceability**: Complete audit trail from PDF to samples
2. **Organization**: Samples grouped by their source document
3. **Efficiency**: Process entire PDFs with multiple samples at once
4. **Visibility**: See which samples came from which submission
5. **Status Tracking**: Track processing status at submission level

## Example Usage

1. Upload a PDF with 43 samples
2. System creates 1 submission + 43 linked samples
3. View in `/submissions` page
4. Click to expand and see all samples
5. Each sample shows its number within the submission

This hierarchical approach provides better organization and tracking for batch sample submissions while maintaining detailed information for each individual sample. 