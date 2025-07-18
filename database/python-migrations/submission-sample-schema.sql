-- Migration: Comprehensive Nanopore Submission and Sample Schema
-- This migration creates separate tables for submissions and samples with all PDF fields

-- Drop existing tables if they exist (be careful in production!)
DROP TABLE IF EXISTS nanopore_attachments CASCADE;
DROP TABLE IF EXISTS nanopore_processing_steps CASCADE;
DROP TABLE IF EXISTS nanopore_sample_details CASCADE;
DROP TABLE IF EXISTS nanopore_samples CASCADE;
DROP TABLE IF EXISTS nanopore_submissions CASCADE;

-- Create submissions table (one submission can have multiple samples)
CREATE TABLE nanopore_submissions (
    id VARCHAR PRIMARY KEY,
    
    -- Submission metadata
    submission_number VARCHAR(100) UNIQUE NOT NULL, -- e.g., "HTSF-JL-147"
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pdf_filename VARCHAR(255),
    pdf_path VARCHAR(500),
    
    -- Submitter information
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    submitter_phone VARCHAR(50),
    
    -- Organization information
    organization_name VARCHAR(255),
    department VARCHAR(255),
    lab_name VARCHAR(255),
    pi_name VARCHAR(255), -- Principal Investigator
    
    -- Project information
    project_id VARCHAR(100), -- Service Project ID from iLab
    project_name VARCHAR(255),
    grant_number VARCHAR(100),
    po_number VARCHAR(100), -- Purchase Order
    
    -- Billing information
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_address TEXT,
    account_number VARCHAR(100),
    
    -- Service requirements
    service_type VARCHAR(100), -- e.g., "Full Service", "Library Prep Only"
    sequencing_platform VARCHAR(50),
    estimated_samples INTEGER,
    priority VARCHAR(10) DEFAULT 'normal',
    
    -- Special requirements
    special_instructions TEXT,
    hazardous_materials BOOLEAN DEFAULT FALSE,
    hazard_details TEXT,
    
    -- Data delivery
    data_delivery_method VARCHAR(50),
    data_retention_days INTEGER DEFAULT 30,
    
    -- Processing preferences
    demultiplexing_required BOOLEAN DEFAULT TRUE,
    basecalling_required BOOLEAN DEFAULT TRUE,
    alignment_required BOOLEAN DEFAULT FALSE,
    analysis_required BOOLEAN DEFAULT FALSE,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'draft',
    received_date TIMESTAMP,
    completed_date TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- User tracking
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Create samples table (individual samples within a submission)
CREATE TABLE nanopore_samples (
    id VARCHAR PRIMARY KEY,
    submission_id VARCHAR NOT NULL REFERENCES nanopore_submissions(id) ON DELETE CASCADE,
    
    -- Sample identification
    sample_name VARCHAR(255) NOT NULL,
    sample_id VARCHAR(100), -- Customer's internal ID
    barcode VARCHAR(50),
    
    -- Sample type and source
    sample_type VARCHAR(50) NOT NULL,
    organism VARCHAR(255),
    strain VARCHAR(255),
    tissue_type VARCHAR(255),
    
    -- Sample properties
    concentration FLOAT, -- ng/μL
    concentration_method VARCHAR(100), -- e.g., "Qubit", "NanoDrop"
    volume FLOAT, -- μL
    total_amount FLOAT, -- ng
    buffer VARCHAR(100),
    
    -- Quality metrics
    a260_280 FLOAT,
    a260_230 FLOAT,
    rin_score FLOAT, -- RNA Integrity Number
    dv200 FLOAT, -- Percentage of fragments > 200nt
    
    -- Library prep details
    library_prep_kit VARCHAR(255),
    library_prep_method VARCHAR(255),
    fragmentation_method VARCHAR(255),
    size_selection VARCHAR(100),
    amplification_cycles INTEGER,
    
    -- Sequencing parameters
    flow_cell_type VARCHAR(50),
    flow_cell_count INTEGER DEFAULT 1,
    read_length VARCHAR(50),
    coverage_target FLOAT,
    
    -- Barcoding
    barcode_kit VARCHAR(100),
    barcode_sequence VARCHAR(255),
    
    -- Reference genome
    reference_genome VARCHAR(255),
    reference_version VARCHAR(50),
    
    -- Special handling
    priority VARCHAR(10) DEFAULT 'normal',
    hazardous BOOLEAN DEFAULT FALSE,
    special_handling TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'submitted',
    qc_status VARCHAR(20) DEFAULT 'pending',
    library_prep_status VARCHAR(20) DEFAULT 'pending',
    sequencing_status VARCHAR(20) DEFAULT 'pending',
    analysis_status VARCHAR(20) DEFAULT 'not_required',
    
    -- Assignment tracking
    assigned_to VARCHAR(255),
    qc_by VARCHAR(255),
    library_prep_by VARCHAR(255),
    sequencing_by VARCHAR(255),
    
    -- Results
    qc_passed BOOLEAN,
    qc_notes TEXT,
    library_yield FLOAT, -- ng
    library_size INTEGER, -- bp
    reads_generated BIGINT,
    bases_generated BIGINT,
    mean_read_length FLOAT,
    mean_quality_score FLOAT,
    
    -- Timestamps
    received_at TIMESTAMP,
    qc_started_at TIMESTAMP,
    qc_completed_at TIMESTAMP,
    library_prep_started_at TIMESTAMP,
    library_prep_completed_at TIMESTAMP,
    sequencing_started_at TIMESTAMP,
    sequencing_completed_at TIMESTAMP,
    analysis_started_at TIMESTAMP,
    analysis_completed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional data (JSON for flexibility)
    custom_fields JSONB
);

-- Create processing steps table
CREATE TABLE nanopore_processing_steps (
    id VARCHAR PRIMARY KEY,
    sample_id VARCHAR NOT NULL REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    step_name VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    
    assigned_to VARCHAR(255),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    estimated_duration_hours INTEGER,
    actual_duration_hours FLOAT,
    
    notes TEXT,
    results JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sample details table (for additional fields from PDF)
CREATE TABLE nanopore_sample_details (
    id VARCHAR PRIMARY KEY,
    sample_id VARCHAR NOT NULL REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    field_type VARCHAR(50), -- text, number, date, boolean
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create attachments table
CREATE TABLE nanopore_attachments (
    id VARCHAR PRIMARY KEY,
    submission_id VARCHAR NOT NULL REFERENCES nanopore_submissions(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL, -- bytes
    
    description TEXT,
    uploaded_by VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_submissions_status ON nanopore_submissions(status);
CREATE INDEX idx_submissions_created_at ON nanopore_submissions(created_at);
CREATE INDEX idx_submissions_submitter_email ON nanopore_submissions(submitter_email);

CREATE INDEX idx_samples_submission_id ON nanopore_samples(submission_id);
CREATE INDEX idx_samples_status ON nanopore_samples(status);
CREATE INDEX idx_samples_sample_name ON nanopore_samples(sample_name);
CREATE INDEX idx_samples_created_at ON nanopore_samples(created_at);

CREATE INDEX idx_processing_steps_sample_id ON nanopore_processing_steps(sample_id);
CREATE INDEX idx_processing_steps_status ON nanopore_processing_steps(status);

CREATE INDEX idx_sample_details_sample_id ON nanopore_sample_details(sample_id);
CREATE INDEX idx_attachments_submission_id ON nanopore_attachments(submission_id);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_nanopore_submissions_updated_at BEFORE UPDATE ON nanopore_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nanopore_samples_updated_at BEFORE UPDATE ON nanopore_samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nanopore_processing_steps_updated_at BEFORE UPDATE ON nanopore_processing_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 