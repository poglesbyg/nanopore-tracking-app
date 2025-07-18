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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Submission metadata
    submission_number VARCHAR(100) UNIQUE NOT NULL, -- e.g., "HTSF-JL-147"
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
    
    -- Quote information
    quote_number VARCHAR(100),
    quote_date DATE,
    quote_amount DECIMAL(10,2),
    quote_valid_until DATE,
    
    -- Service details
    service_type VARCHAR(100), -- "Nanopore Sequencing", "Library Prep + Sequencing", etc.
    turnaround_time VARCHAR(50), -- "Standard (2-3 weeks)", "Rush (1 week)", etc.
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Special requirements
    special_instructions TEXT,
    hazardous_materials BOOLEAN DEFAULT false,
    hazard_details TEXT,
    
    -- Data delivery preferences
    data_delivery_method VARCHAR(50), -- "download", "cloud", "hard drive"
    cloud_storage_path VARCHAR(255),
    notification_preferences JSONB, -- {"email": true, "sms": false}
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, accepted, in_progress, completed, cancelled
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Administrative fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_submission_status CHECK (status IN ('draft', 'submitted', 'accepted', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Create samples table (multiple samples per submission)
CREATE TABLE nanopore_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES nanopore_submissions(id) ON DELETE CASCADE,
    
    -- Sample identification
    sample_name VARCHAR(255) NOT NULL,
    sample_number INTEGER NOT NULL, -- Order within submission (1, 2, 3...)
    internal_id VARCHAR(100), -- Lab's internal tracking ID
    external_id VARCHAR(100), -- Customer's ID
    
    -- Sample type and source
    sample_type VARCHAR(100) NOT NULL, -- "Genomic DNA", "Total RNA", "PCR Product", etc.
    organism VARCHAR(255),
    tissue_type VARCHAR(255),
    cell_type VARCHAR(255),
    growth_conditions TEXT,
    
    -- Sample preparation details
    extraction_method VARCHAR(255),
    extraction_date DATE,
    extraction_kit VARCHAR(255),
    
    -- Sample quality metrics
    concentration DECIMAL(10,3), -- ng/μL
    concentration_method VARCHAR(100), -- "Qubit", "NanoDrop", "Bioanalyzer"
    volume DECIMAL(10,2), -- μL
    total_amount DECIMAL(10,3), -- ng (calculated)
    
    -- Purity measurements
    a260_280 DECIMAL(4,2), -- Purity ratio
    a260_230 DECIMAL(4,2), -- Purity ratio
    rin_score DECIMAL(3,1), -- RNA Integrity Number (for RNA samples)
    dna_integrity_number DECIMAL(3,1), -- DIN (for DNA samples)
    
    -- Fragment size information
    fragment_size_min INTEGER, -- bp
    fragment_size_max INTEGER, -- bp
    fragment_size_avg INTEGER, -- bp
    fragment_size_distribution TEXT, -- Description or file reference
    
    -- Library preparation requirements
    library_prep_method VARCHAR(100), -- "Ligation", "Rapid", "PCR-free", "cDNA"
    library_prep_kit VARCHAR(100), -- "SQK-LSK114", "SQK-RBK114", etc.
    barcoding_required BOOLEAN DEFAULT false,
    barcode_kit VARCHAR(100), -- "EXP-NBD114", etc.
    barcode_number VARCHAR(20), -- "BC01", "BC02", etc.
    
    -- Sequencing parameters
    flow_cell_type VARCHAR(50), -- "R9.4.1", "R10.4.1", "R10.3"
    flow_cell_count INTEGER DEFAULT 1,
    sequencing_chemistry VARCHAR(50), -- "Kit 14", "Kit 12"
    
    -- Expected outputs
    expected_yield_gb DECIMAL(10,2), -- Expected data in GB
    expected_read_length VARCHAR(50), -- "Standard (5-30kb)", "Long (>30kb)", "Ultra-long (>100kb)"
    expected_read_n50 INTEGER, -- Expected N50 in bp
    target_coverage DECIMAL(10,2), -- Target coverage depth (e.g., 30x)
    
    -- Reference genome information
    reference_genome VARCHAR(255), -- "hg38", "mm10", custom reference
    reference_genome_url VARCHAR(500), -- Link to custom reference
    genome_size_mb DECIMAL(10,2), -- Genome size in Mb
    
    -- Basecalling preferences
    basecalling_model VARCHAR(100), -- "super-accurate", "fast", "hac"
    basecalling_config VARCHAR(100), -- Specific Guppy/Dorado config
    modifications_calling BOOLEAN DEFAULT false, -- Detect base modifications
    
    -- Analysis requirements
    analysis_required BOOLEAN DEFAULT false,
    demultiplexing_required BOOLEAN DEFAULT false,
    adapter_trimming BOOLEAN DEFAULT true,
    quality_filtering BOOLEAN DEFAULT true,
    
    -- Specific analyses requested
    genome_assembly BOOLEAN DEFAULT false,
    variant_calling BOOLEAN DEFAULT false,
    structural_variant_detection BOOLEAN DEFAULT false,
    methylation_calling BOOLEAN DEFAULT false,
    transcriptome_analysis BOOLEAN DEFAULT false,
    metagenomics_analysis BOOLEAN DEFAULT false,
    
    -- Custom analysis parameters
    custom_analysis_params JSONB,
    
    -- Data output preferences
    output_format VARCHAR(50)[], -- Array: ["FASTQ", "FAST5", "POD5", "BAM"]
    compression_required BOOLEAN DEFAULT true,
    
    -- Quality control
    qc_status VARCHAR(50) DEFAULT 'pending', -- pending, passed, failed, conditional
    qc_notes TEXT,
    qc_metrics JSONB, -- Detailed QC metrics
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'submitted',
    library_prep_status VARCHAR(50) DEFAULT 'pending',
    sequencing_status VARCHAR(50) DEFAULT 'pending',
    analysis_status VARCHAR(50) DEFAULT 'pending',
    
    -- Assignment and tracking
    assigned_to VARCHAR(255),
    library_prep_by VARCHAR(255),
    sequencing_by VARCHAR(255),
    analysis_by VARCHAR(255),
    
    -- Important dates
    received_date DATE,
    library_prep_date DATE,
    sequencing_start_date DATE,
    sequencing_end_date DATE,
    analysis_complete_date DATE,
    data_delivered_date DATE,
    
    -- Results and metrics
    actual_yield_gb DECIMAL(10,2),
    actual_read_n50 INTEGER,
    actual_read_count BIGINT,
    actual_coverage DECIMAL(10,2),
    pass_reads_percentage DECIMAL(5,2),
    
    -- File paths
    raw_data_path VARCHAR(500),
    processed_data_path VARCHAR(500),
    analysis_results_path VARCHAR(500),
    report_path VARCHAR(500),
    
    -- Notes and communication
    internal_notes TEXT,
    customer_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_sample_status CHECK (status IN ('submitted', 'received', 'qc', 'library_prep', 'sequencing', 'analysis', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_qc_status CHECK (qc_status IN ('pending', 'passed', 'failed', 'conditional')),
    CONSTRAINT unique_sample_per_submission UNIQUE (submission_id, sample_number)
);

-- Create table for tracking workflow steps
CREATE TABLE nanopore_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    step_number INTEGER NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_category VARCHAR(50), -- "QC", "Library Prep", "Sequencing", "Analysis"
    
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_hours DECIMAL(10,2),
    
    performed_by VARCHAR(255),
    
    -- Step-specific data
    input_metrics JSONB,
    output_metrics JSONB,
    parameters_used JSONB,
    
    notes TEXT,
    issues_encountered TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_step_per_sample UNIQUE (sample_id, step_number)
);

-- Create table for file attachments
CREATE TABLE nanopore_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Can be attached to either submission or sample
    submission_id UUID REFERENCES nanopore_submissions(id) ON DELETE CASCADE,
    sample_id UUID REFERENCES nanopore_samples(id) ON DELETE CASCADE,
    
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes BIGINT,
    file_path VARCHAR(500),
    
    attachment_type VARCHAR(50), -- "submission_form", "qc_report", "bioanalyzer", "gel_image", etc.
    description TEXT,
    
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure attachment is linked to either submission or sample
    CONSTRAINT attachment_parent CHECK (
        (submission_id IS NOT NULL AND sample_id IS NULL) OR
        (submission_id IS NULL AND sample_id IS NOT NULL)
    )
);

-- Create table for communication/notes
CREATE TABLE nanopore_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    submission_id UUID REFERENCES nanopore_submissions(id) ON DELETE CASCADE,
    sample_id UUID REFERENCES nanopore_samples(id),
    
    communication_type VARCHAR(50), -- "email", "phone", "note", "status_update"
    direction VARCHAR(20), -- "incoming", "outgoing", "internal"
    
    subject VARCHAR(255),
    content TEXT NOT NULL,
    
    from_user VARCHAR(255),
    to_user VARCHAR(255),
    
    attachments JSONB, -- Array of attachment IDs
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_submissions_status ON nanopore_submissions(status);
CREATE INDEX idx_submissions_submitter ON nanopore_submissions(submitter_email);
CREATE INDEX idx_submissions_date ON nanopore_submissions(submission_date);
CREATE INDEX idx_submissions_number ON nanopore_submissions(submission_number);

CREATE INDEX idx_samples_submission ON nanopore_samples(submission_id);
CREATE INDEX idx_samples_status ON nanopore_samples(status);
CREATE INDEX idx_samples_name ON nanopore_samples(sample_name);
CREATE INDEX idx_samples_assigned ON nanopore_samples(assigned_to);
CREATE INDEX idx_samples_qc_status ON nanopore_samples(qc_status);

CREATE INDEX idx_workflow_sample ON nanopore_workflow_steps(sample_id);
CREATE INDEX idx_workflow_status ON nanopore_workflow_steps(status);

CREATE INDEX idx_attachments_submission ON nanopore_attachments(submission_id);
CREATE INDEX idx_attachments_sample ON nanopore_attachments(sample_id);

CREATE INDEX idx_communications_submission ON nanopore_communications(submission_id);
CREATE INDEX idx_communications_sample ON nanopore_communications(sample_id);

-- Create triggers for timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nanopore_submissions_updated_at BEFORE UPDATE ON nanopore_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nanopore_samples_updated_at BEFORE UPDATE ON nanopore_samples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nanopore_workflow_steps_updated_at BEFORE UPDATE ON nanopore_workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE nanopore_submissions IS 'Master table for nanopore sequencing submissions containing quote and project information';
COMMENT ON TABLE nanopore_samples IS 'Individual samples within a submission with all technical details and requirements';
COMMENT ON TABLE nanopore_workflow_steps IS 'Tracks the progress of each sample through the workflow';
COMMENT ON TABLE nanopore_attachments IS 'File attachments for submissions and samples';
COMMENT ON TABLE nanopore_communications IS 'Communication log for submissions and samples';

-- Add column comments for key fields
COMMENT ON COLUMN nanopore_submissions.submission_number IS 'Unique submission identifier like HTSF-JL-147';
COMMENT ON COLUMN nanopore_samples.sample_number IS 'Order of sample within submission (1, 2, 3...)';
COMMENT ON COLUMN nanopore_samples.a260_280 IS 'DNA purity ratio, should be ~1.8 for pure DNA';
COMMENT ON COLUMN nanopore_samples.a260_230 IS 'Secondary purity ratio, should be 2.0-2.2';
COMMENT ON COLUMN nanopore_samples.rin_score IS 'RNA Integrity Number, 1-10 scale, >7 is good'; 