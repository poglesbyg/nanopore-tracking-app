-- AI Processing Database Schema
-- Python microservices migration

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS ai_db;

-- Use the database
\c ai_db;

-- Create processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    job_type VARCHAR(50) NOT NULL, -- pdf_extract, llm_process, rag_enhance
    status VARCHAR(20) DEFAULT 'pending',
    
    -- Input data
    input_file_path VARCHAR(500),
    input_text TEXT,
    input_params TEXT, -- JSON string
    
    -- Output data
    output_data TEXT, -- JSON string
    confidence_score DECIMAL(5, 2),
    processing_time_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create extracted fields table
CREATE TABLE IF NOT EXISTS extracted_fields (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    confidence DECIMAL(5, 2),
    extraction_method VARCHAR(50), -- llm, pattern, rag
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create model performance table
CREATE TABLE IF NOT EXISTS model_performance (
    id VARCHAR(36) PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    job_type VARCHAR(50) NOT NULL,
    accuracy_score DECIMAL(5, 2),
    processing_time_avg INTEGER,
    total_jobs INTEGER DEFAULT 0,
    successful_jobs INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create knowledge base table for RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
    id VARCHAR(36) PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50),
    content TEXT NOT NULL,
    embedding_vector VECTOR(1536), -- For OpenAI embeddings
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_type ON processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_extracted_fields_job_id ON extracted_fields(job_id);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_field_name ON extracted_fields(field_name);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_extraction_method ON extracted_fields(extraction_method);

CREATE INDEX IF NOT EXISTS idx_model_performance_model_name ON model_performance(model_name);
CREATE INDEX IF NOT EXISTS idx_model_performance_job_type ON model_performance(job_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_document_type ON knowledge_base(document_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_at ON knowledge_base(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_processing_jobs_updated_at 
    BEFORE UPDATE ON processing_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_performance_updated_at 
    BEFORE UPDATE ON model_performance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at 
    BEFORE UPDATE ON knowledge_base 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample model performance data
INSERT INTO model_performance (
    id, model_name, model_version, job_type, accuracy_score, processing_time_avg, total_jobs, successful_jobs
) VALUES 
(
    'model-001', 'llama2', '7b', 'pdf_extract', 85.5, 2500, 100, 95
),
(
    'model-002', 'gpt-3.5-turbo', 'latest', 'llm_process', 92.3, 1800, 150, 145
) ON CONFLICT (id) DO NOTHING;

-- Insert sample knowledge base entries
INSERT INTO knowledge_base (
    id, document_name, document_type, content, metadata
) VALUES 
(
    'kb-001', 
    'Nanopore Sequencing Guide', 
    'guide', 
    'Nanopore sequencing is a third-generation sequencing technology that enables real-time analysis of long DNA or RNA fragments.',
    '{"category": "sequencing", "tags": ["nanopore", "sequencing", "guide"]}'
),
(
    'kb-002', 
    'Sample Preparation Protocol', 
    'protocol', 
    'Sample preparation for nanopore sequencing requires careful handling of DNA/RNA to maintain fragment length and quality.',
    '{"category": "protocol", "tags": ["sample", "preparation", "protocol"]}'
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres; 