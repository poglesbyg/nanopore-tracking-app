-- Migration: Add PDF-derived QC metrics to nanopore_samples and expose via sample_hierarchy view

BEGIN;

-- Add new columns capturing real-world PDF fields
ALTER TABLE nanopore_samples
  ADD COLUMN IF NOT EXISTS qubit_concentration DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS nanodrop_concentration DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS a260_280_ratio DECIMAL(6,3),
  ADD COLUMN IF NOT EXISTS a260_230_ratio DECIMAL(6,3);

-- Recreate sample_hierarchy view to include the new fields
DROP VIEW IF EXISTS sample_hierarchy;

-- Ensure a default project exists to associate legacy submissions
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  chart_prefix VARCHAR(10) DEFAULT 'PROJ' CHECK (chart_prefix IN ('HTSF', 'NANO', 'SEQ', 'PROJ')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO projects (id, name, description, owner_name, owner_email, status)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Default Project',
  'Default project for all submissions',
  'System Admin',
  'admin@system.local',
  'active'
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE nanopore_submissions 
  ADD COLUMN IF NOT EXISTS project_ref_id UUID REFERENCES projects(id) ON DELETE SET NULL;

UPDATE nanopore_submissions 
SET project_ref_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE project_ref_id IS NULL;

CREATE OR REPLACE VIEW sample_hierarchy AS
SELECT 
  -- Project information
  COALESCE(p.id, '00000000-0000-0000-0000-000000000001'::UUID) as project_id,
  COALESCE(p.name, 'Default Project') as project_name,
  COALESCE(p.status, 'active') as project_status,

  -- Submission information
  ns.id as submission_id,
  COALESCE(ns.project_name, 'Untitled Submission') as submission_name,
  ns.status as submission_status,
  'pdf' as submission_type,
  ns.submission_date as submitted_at,

  -- Sample information with expanded QC metrics
  s.id as sample_id,
  s.sample_name,
  s.internal_id as sample_identifier,
  s.status as sample_status,
  ns.priority as sample_priority,
  s.sample_type,
  ns.lab_name,
  s.chart_field,
  ns.submitter_name,
  ns.submitter_email,
  s.concentration,
  'ng/μL' as concentration_unit,
  s.volume,
  'μL' as volume_unit,
  s.qubit_concentration,
  s.nanodrop_concentration,
  s.a260_280_ratio,
  s.a260_230_ratio,
  s.status as workflow_stage,
  s.flow_cell_count,
  s.created_at as sample_created_at,
  s.updated_at as sample_updated_at
FROM nanopore_submissions ns
LEFT JOIN projects p ON ns.project_ref_id = p.id
LEFT JOIN nanopore_samples s ON ns.id = s.submission_id
ORDER BY ns.submission_date DESC, s.created_at DESC;

COMMIT;


