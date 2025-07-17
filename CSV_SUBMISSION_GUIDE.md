# Nanopore Sample Submission CSV Guide

*Context added by Giga sample-tracking-model*

## Overview

This guide explains how to submit nanopore sequencing samples using the CSV template. The template includes all required and optional fields for the 8-step nanopore workflow system.

## CSV Template Structure

The CSV template includes the following columns:

### Required Fields (Must be filled)

| Field | Description | Format | Example | Validation Rules |
|-------|-------------|--------|---------|------------------|
| `sample_name` | Unique sample identifier | Alphanumeric, hyphens, underscores | `SAMPLE001`, `DNA_Sample_1` | 1-255 chars, no special chars except `-_.` |
| `submitter_name` | Person submitting the sample | Letters, spaces, hyphens, apostrophes | `John Doe`, `Dr. Smith` | 1-255 chars, letters only |
| `submitter_email` | Contact email address | Valid email format | `john.doe@university.edu` | Must be valid email format |
| `sample_type` | Type of sample material | Enum value | `DNA`, `RNA`, `Protein`, `Other` | Must be one of the listed values |
| `chart_field` | Chart field identifier | Specific format | `HTSF-001`, `NANO-002`, `SEQ-003` | Must match pattern: `(HTSF\|NANO\|SEQ)-\d{3}` |

### Optional Fields (Can be left empty)

| Field | Description | Format | Example | Validation Rules |
|-------|-------------|--------|---------|------------------|
| `project_id` | Service Project ID from iLab | Alphanumeric, hyphens, underscores | `HTSF-001`, `NANO-002` | Max 100 chars, alphanumeric only |
| `lab_name` | Laboratory or department name | Letters, numbers, spaces, punctuation | `Genomics Lab`, `RNA Sequencing Lab` | Max 255 chars |
| `sample_buffer` | Buffer type used | Text | `Tris-EDTA`, `RNase-free water` | Max 100 chars |
| `concentration` | Sample concentration in ng/μL | Decimal number | `50.5`, `25.0` | 0.001-10,000 ng/μL |
| `volume` | Sample volume in μL | Decimal number | `20.0`, `50.0` | 0.1-1,000 μL |
| `total_amount` | Total amount in ng | Decimal number | `1010.0`, `1250.0` | 0.001-100,000 ng |
| `flow_cell_type` | Flow cell type | Enum value | `R9.4.1`, `R10.4.1`, `R10.5.1`, `Other` | Must be one of listed values |
| `flow_cell_count` | Number of flow cells needed | Integer | `1`, `2` | 1-10 flow cells |
| `priority` | Processing priority level | Enum value | `low`, `normal`, `high`, `urgent` | Must be one of listed values |
| `assigned_to` | Staff member assigned | Letters, spaces, hyphens, apostrophes | `Dr. Smith`, `Grey` | Max 255 chars, letters only |
| `library_prep_by` | Person doing library prep | Letters, spaces, hyphens, apostrophes | `Stephanie`, `Jenny` | Max 255 chars, letters only |

## Field Details and Constraints

### Sample Name (`sample_name`)
- **Required**: Yes
- **Format**: Alphanumeric characters, hyphens, underscores, dots, spaces
- **Length**: 1-255 characters
- **Examples**: `SAMPLE001`, `DNA_Sample_1`, `RNA-001`, `Plasmid_003`
- **Validation**: Must be unique within the system

### Chart Field (`chart_field`)
- **Required**: Yes
- **Format**: Must follow pattern `(HTSF|NANO|SEQ)-\d{3}`
- **Valid Values**: 
  - `HTSF-001` through `HTSF-005`
  - `NANO-001` through `NANO-005`
  - `SEQ-001` through `SEQ-005`
- **Purpose**: Used for intake validation and project tracking

### Sample Type (`sample_type`)
- **Required**: Yes
- **Valid Values**: `DNA`, `RNA`, `Protein`, `Other`
- **Description**: Type of nucleic acid or biomolecule being sequenced

### Priority Levels (`priority`)
- **Default**: `normal`
- **Valid Values**: `low`, `normal`, `high`, `urgent`
- **Impact**: Affects processing queue order and turnaround time

### Flow Cell Types (`flow_cell_type`)
- **Valid Values**: `R9.4.1`, `R10.4.1`, `R10.5.1`, `Other`
- **Description**: Oxford Nanopore flow cell chemistry version

### Concentration and Volume Calculations
- If both `concentration` and `volume` are provided, `total_amount` should equal `concentration × volume`
- **Example**: 50.5 ng/μL × 20.0 μL = 1010.0 ng
- The system will validate this calculation automatically

## CSV Template Usage

### 1. Download the Template
Use the provided `nanopore-sample-submission-template.csv` file as your starting point.

### 2. Fill in Required Fields
Ensure all required fields are completed:
- `sample_name`
- `submitter_name`
- `submitter_email`
- `sample_type`
- `chart_field`

### 3. Add Optional Information
Fill in optional fields as available:
- Project details
- Sample specifications
- Processing preferences
- Assignment information

### 4. Validation Checklist
Before submission, verify:
- [ ] All required fields are filled
- [ ] Email addresses are valid
- [ ] Chart field matches required format
- [ ] Sample names are unique
- [ ] Concentration/volume calculations are correct
- [ ] No special characters in restricted fields

## Example Submissions

### Basic DNA Sample
```csv
sample_name,project_id,submitter_name,submitter_email,lab_name,sample_type,sample_buffer,concentration,volume,total_amount,flow_cell_type,flow_cell_count,priority,assigned_to,library_prep_by,chart_field
DNA_SAMPLE_001,HTSF-001,Dr. Johnson,johnson@lab.edu,Genomics Lab,DNA,Tris-EDTA,50.0,20.0,1000.0,R9.4.1,1,normal,,,HTSF-001
```

### High-Priority RNA Sample
```csv
sample_name,project_id,submitter_name,submitter_email,lab_name,sample_type,sample_buffer,concentration,volume,total_amount,flow_cell_type,flow_cell_count,priority,assigned_to,library_prep_by,chart_field
URGENT_RNA_002,NANO-002,Jane Wilson,jane@research.org,RNA Lab,RNA,RNase-free water,25.0,50.0,1250.0,R10.4.1,1,urgent,Dr. Smith,Stephanie,NANO-002
```

### Multiple Flow Cell Sample
```csv
sample_name,project_id,submitter_name,submitter_email,lab_name,sample_type,sample_buffer,concentration,volume,total_amount,flow_cell_type,flow_cell_count,priority,assigned_to,library_prep_by,chart_field
LARGE_GENOME_003,SEQ-003,Dr. Brown,brown@university.edu,Genomics Core,DNA,TE Buffer,100.0,10.0,1000.0,R9.4.1,2,high,Grey,Jenny,SEQ-003
```

## Workflow Integration

After CSV submission, samples automatically enter the 8-step nanopore workflow:

1. **Sample QC** (1h) - Initial quality control
2. **Library Preparation** (4h) - DNA/RNA library construction
3. **Library QC** (1h) - Quality metrics validation
4. **Sequencing Setup** (1h) - Flow cell preparation
5. **Sequencing Run** (48h) - Active sequencing
6. **Basecalling** (2h) - Raw signal conversion
7. **Quality Assessment** (1h) - Read quality analysis
8. **Data Delivery** (1h) - Results packaging

## Error Handling

Common validation errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid chart field format" | Chart field doesn't match pattern | Use format: `HTSF-001`, `NANO-002`, `SEQ-003` |
| "Invalid email format" | Email address is malformed | Check email syntax and domain |
| "Sample name contains invalid characters" | Special characters in sample name | Use only letters, numbers, hyphens, underscores |
| "Total amount doesn't match concentration × volume" | Calculation mismatch | Verify: total_amount = concentration × volume |
| "Invalid sample type" | Unsupported sample type | Use: `DNA`, `RNA`, `Protein`, or `Other` |

## Support

For questions about CSV submission or validation errors, contact the nanopore sequencing team or refer to the system documentation. 