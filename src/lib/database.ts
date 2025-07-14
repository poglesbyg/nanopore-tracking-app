import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { dbConfig } from './config'

// Database types (should match your schema)
export interface Database {
  users: {
    id: string
    email: string
    name: string
    created_at: Date
    updated_at: Date
  }
  nanopore_samples: {
    id: string
    sample_name: string
    project_id: string | null
    submitter_name: string
    submitter_email: string
    lab_name: string | null
    sample_type: string
    sample_buffer: string | null
    concentration: number | null
    volume: number | null
    total_amount: number | null
    flow_cell_type: string | null
    flow_cell_count: number
    status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
    priority: 'low' | 'normal' | 'high' | 'urgent'
    assigned_to: string | null
    library_prep_by: string | null
    chart_field: string
    submitted_at: Date
    started_at: Date | null
    completed_at: Date | null
    created_at: Date
    updated_at: Date
    created_by: string
  }
  nanopore_sample_details: {
    id: string
    sample_id: string
    organism: string | null
    genome_size: string | null
    expected_read_length: string | null
    library_prep_kit: string | null
    barcoding_required: boolean
    barcode_kit: string | null
    run_time_hours: number | null
    basecalling_model: string | null
    data_delivery_method: string | null
    file_format: string | null
    analysis_required: boolean
    analysis_type: string | null
    qc_passed: boolean | null
    qc_notes: string | null
    special_instructions: string | null
    internal_notes: string | null
    created_at: Date
    updated_at: Date
  }
  nanopore_processing_steps: {
    id: string
    sample_id: string
    step_name: string
    step_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
    assigned_to: string | null
    started_at: Date | null
    completed_at: Date | null
    estimated_duration_hours: number | null
    notes: string | null
    results_data: any | null
    created_at: Date
    updated_at: Date
  }
  nanopore_attachments: {
    id: string
    sample_id: string
    file_name: string
    file_type: string | null
    file_size_bytes: number | null
    file_path: string | null
    description: string | null
    uploaded_by: string | null
    uploaded_at: Date
    created_at: Date
  }
}

// Create database connection
export function createDatabase(): Kysely<Database> {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: dbConfig.url,
      max: dbConfig.maxConnections,
      idleTimeoutMillis: dbConfig.idleTimeout,
      connectionTimeoutMillis: dbConfig.connectionTimeout,
    })
  })

  return new Kysely<Database>({
    dialect,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  })
}

// Global database instance
export const db = createDatabase()

// Helper to test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await db.selectFrom('nanopore_samples').select('id').limit(1).execute()
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
} 