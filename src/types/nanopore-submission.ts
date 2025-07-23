// Types for Nanopore Submission System

export interface NanoporeSubmission {
  id: string
  submission_number: string
  pdf_filename: string
  
  // Submitter Information
  submitter_name: string
  submitter_email: string
  lab_name?: string
  department?: string
  billing_account?: string
  
  // Submission Details
  submission_date: string
  project_id?: string
  project_name?: string
  
  // Processing Status
  status: 'pending' | 'processing' | 'completed' | 'failed'
  sample_count: number
  samples_completed: number
  
  // Metadata
  pdf_metadata?: Record<string, any>
  extracted_data?: Record<string, any>
  extraction_method?: 'llm' | 'pattern' | 'hybrid' | 'rag'
  extraction_confidence?: number
  
  // Special Instructions
  special_instructions?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  
  // Timestamps
  created_by: string
  created_at: string
  updated_at: string
  
  // Related samples (populated when fetching with samples)
  samples?: NanoporeSampleWithSubmission[]
}

export interface NanoporeSampleWithSubmission {
  id: string
  submission_id: string
  sample_number: number
  sample_name: string
  project_id?: string
  submitter_name: string
  submitter_email: string
  lab_name?: string
  sample_type: string
  sample_buffer?: string
  concentration?: number
  volume?: number
  total_amount?: number
  flow_cell_type?: string
  flow_cell_count?: number
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_to?: string
  library_prep_by?: string
  submitted_at: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  created_by: string
  chart_field: string
}

// Input types for creating/updating
export interface CreateSubmissionInput {
  pdf_filename: string
  submitter_name: string
  submitter_email: string
  lab_name?: string | undefined
  department?: string | undefined
  billing_account?: string | undefined
  project_id?: string | undefined
  project_name?: string | undefined
  special_instructions?: string | undefined
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  pdf_metadata?: Record<string, any>
  extracted_data?: Record<string, any>
  extraction_method?: 'llm' | 'pattern' | 'hybrid' | 'rag'
  extraction_confidence?: number
}

export interface UpdateSubmissionInput {
  submitter_name?: string
  submitter_email?: string
  lab_name?: string
  department?: string
  billing_account?: string
  project_id?: string
  project_name?: string
  special_instructions?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  status?: 'pending' | 'processing' | 'completed' | 'failed'
}

// Sample creation now requires submission_id
export interface CreateSampleForSubmissionInput {
  submission_id: string
  sample_number: number
  sample_name: string
  project_id?: string
  sample_type: 'DNA' | 'RNA' | 'Protein' | 'Other'
  sample_buffer?: string
  concentration?: number
  volume?: number
  flow_cell_type?: 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other'
  flow_cell_count?: number
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  chart_field?: string
}

// For PDF processing result
export interface PDFProcessingResult {
  submission: CreateSubmissionInput
  samples: Array<{
    sample_name: string
    sample_type?: string
    concentration?: number
    volume?: number
    flow_cell_type?: string
    // Other sample-specific fields
  }>
} 