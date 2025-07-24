import { Kysely, sql } from 'kysely'

// Database schema for AI Processing Service
export interface AIProcessingDatabase {
  processing_jobs: ProcessingJobTable
  extracted_data: ExtractedDataTable
  vector_embeddings: VectorEmbeddingTable
  processing_templates: ProcessingTemplateTable
  validation_rules: ValidationRuleTable
}

// Processing jobs table
export interface ProcessingJobTable {
  id: string
  sample_id?: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  processing_type: string
  status: string
  progress: number
  result?: string // JSON string
  error?: string
  metadata?: string // JSON string
  created_at: Date
  updated_at: Date
  started_at?: Date
  completed_at?: Date
}

// Extracted data table
export interface ExtractedDataTable {
  id: string
  job_id: string
  field_name: string
  field_value: string
  confidence: number
  confidence_level: string
  source: string
  page_number?: number
  bounding_box?: string // JSON string
  validation_errors?: string // JSON string
  created_at: Date
  updated_at: Date
}

// Vector embeddings table
export interface VectorEmbeddingTable {
  id: string
  job_id: string
  content: string
  embedding: string // Vector stored as JSON array string
  metadata?: string // JSON string
  created_at: Date
  updated_at: Date
}

// Processing templates table
export interface ProcessingTemplateTable {
  id: string
  name: string
  description?: string
  processing_type: string
  template_config: string // JSON string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// Validation rules table
export interface ValidationRuleTable {
  id: string
  template_id: string
  field_name: string
  required: boolean
  field_type: string
  min_length?: number
  max_length?: number
  min_value?: number
  max_value?: number
  pattern?: string
  allowed_values?: string // JSON string
  custom_validation?: string
  created_at: Date
  updated_at: Date
}

// Migration function
export async function migrateAIProcessingDatabase(db: Kysely<AIProcessingDatabase>): Promise<void> {
  // Create processing jobs table
  await db.schema
    .createTable('processing_jobs')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('sample_id', 'uuid')
    .addColumn('file_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('file_path', 'varchar(500)', (col) => col.notNull())
    .addColumn('file_size', 'bigint', (col) => col.notNull())
    .addColumn('mime_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('processing_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('pending'))
    .addColumn('progress', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('result', 'jsonb')
    .addColumn('error', 'text')
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('started_at', 'timestamp')
    .addColumn('completed_at', 'timestamp')
    .execute()

  // Create extracted data table
  await db.schema
    .createTable('extracted_data')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('job_id', 'uuid', (col) => col.notNull().references('processing_jobs.id').onDelete('cascade'))
    .addColumn('field_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('field_value', 'text', (col) => col.notNull())
    .addColumn('confidence', 'numeric', (col) => col.notNull())
    .addColumn('confidence_level', 'varchar(20)', (col) => col.notNull())
    .addColumn('source', 'varchar(50)', (col) => col.notNull())
    .addColumn('page_number', 'integer')
    .addColumn('bounding_box', 'jsonb')
    .addColumn('validation_errors', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create vector embeddings table (using jsonb for embeddings instead of vector type)
  await db.schema
    .createTable('vector_embeddings')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('job_id', 'uuid', (col) => col.notNull().references('processing_jobs.id').onDelete('cascade'))
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('embedding', 'jsonb', (col) => col.notNull()) // Store as JSON array
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create processing templates table
  await db.schema
    .createTable('processing_templates')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(100)', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('processing_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('template_config', 'jsonb', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create validation rules table
  await db.schema
    .createTable('validation_rules')
    .ifNotExists()
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('template_id', 'uuid', (col) => col.notNull().references('processing_templates.id').onDelete('cascade'))
    .addColumn('field_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('required', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('field_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('min_length', 'integer')
    .addColumn('max_length', 'integer')
    .addColumn('min_value', 'numeric')
    .addColumn('max_value', 'numeric')
    .addColumn('pattern', 'text')
    .addColumn('allowed_values', 'jsonb')
    .addColumn('custom_validation', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  // Create indexes
  await db.schema
    .createIndex('idx_processing_jobs_sample_id')
    .on('processing_jobs')
    .column('sample_id')
    .execute()

  await db.schema
    .createIndex('idx_processing_jobs_status')
    .on('processing_jobs')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_extracted_data_job_id')
    .on('extracted_data')
    .column('job_id')
    .execute()

  await db.schema
    .createIndex('idx_vector_embeddings_job_id')
    .on('vector_embeddings')
    .column('job_id')
    .execute()

  // Insert default processing templates
  const defaultTemplates = [
    {
      name: 'Nanopore Submission Form',
      description: 'Template for processing nanopore submission forms',
      processing_type: 'pdf_extraction',
      template_config: JSON.stringify({
        expectedFields: [
          'sample_name', 'submitter_name', 'submitter_email', 'organism',
          'concentration', 'volume', 'buffer', 'library_prep', 'sequencing_type'
        ],
        requiredFields: ['sample_name', 'submitter_name', 'submitter_email'],
        extractionPrompt: 'Extract nanopore sample submission information from this form'
      }),
      is_active: true
    }
  ]

  // Only insert if templates don't exist
  const existingTemplates = await db
    .selectFrom('processing_templates')
    .select('id')
    .execute()

  if (existingTemplates.length === 0) {
    for (const template of defaultTemplates) {
      await db
        .insertInto('processing_templates')
        .values(template)
        .execute()
    }
  }
}

// Helper function to create update triggers (simplified - just for documentation)
export function getUpdateTriggerSQL(): string {
  return `
    -- Create update trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Apply triggers to tables
    CREATE TRIGGER processing_jobs_updated_at_trigger
      BEFORE UPDATE ON processing_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER extracted_data_updated_at_trigger
      BEFORE UPDATE ON extracted_data
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER vector_embeddings_updated_at_trigger
      BEFORE UPDATE ON vector_embeddings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER processing_templates_updated_at_trigger
      BEFORE UPDATE ON processing_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER validation_rules_updated_at_trigger
      BEFORE UPDATE ON validation_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `
}