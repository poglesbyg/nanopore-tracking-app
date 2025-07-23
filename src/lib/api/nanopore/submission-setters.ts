import type { DB } from '../../db/types'
import type { Selectable, Insertable, Updateable, Kysely, Transaction } from 'kysely'
import type { CreateSubmissionInput, UpdateSubmissionInput, CreateSampleForSubmissionInput } from '@/types/nanopore-submission'

/**
 * Create a new submission
 */
export async function createNanoporeSubmission(
  db: Kysely<DB>,
  submissionData: CreateSubmissionInput & { created_by: string },
): Promise<Selectable<DB['nanopore_submissions']>> {
  const now = new Date().toISOString()
  
  return await db
    .insertInto('nanopore_submissions')
    .values({
      pdf_filename: submissionData.pdf_filename,
      submitter_name: submissionData.submitter_name,
      submitter_email: submissionData.submitter_email,
      lab_name: submissionData.lab_name || null,
      department: submissionData.department || null,
      billing_account: submissionData.billing_account || null,
      project_id: submissionData.project_id || null,
      project_name: submissionData.project_name || null,
      special_instructions: submissionData.special_instructions || null,
      priority: submissionData.priority || 'normal',
      pdf_metadata: submissionData.pdf_metadata || null,
      extracted_data: submissionData.extracted_data || null,
      extraction_method: submissionData.extraction_method || null,
      extraction_confidence: submissionData.extraction_confidence || null,
      status: 'pending',
      sample_count: 0,
      samples_completed: 0,
      created_by: submissionData.created_by,
      submission_date: now,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update a submission
 */
export async function updateNanoporeSubmission(
  db: Kysely<DB>,
  submissionId: string,
  updateData: UpdateSubmissionInput,
): Promise<Selectable<DB['nanopore_submissions']>> {
  const now = new Date().toISOString()
  
  const finalUpdateData: any = {
    ...updateData,
    updated_at: now,
  }
  
  return await db
    .updateTable('nanopore_submissions')
    .set(finalUpdateData)
    .where('id', '=', submissionId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Create samples for a submission
 */
export async function createSamplesForSubmission(
  db: Kysely<DB>,
  submissionId: string,
  samples: Array<CreateSampleForSubmissionInput>,
  createdBy: string,
): Promise<Array<Selectable<DB['nanopore_samples']>>> {
  const now = new Date().toISOString()
  
  // Get submission data to inherit some fields
  const submission = await db
    .selectFrom('nanopore_submissions')
    .selectAll()
    .where('id', '=', submissionId)
    .executeTakeFirstOrThrow()
  
  const sampleValues = samples.map((sample, index) => ({
    submission_id: submissionId,
    sample_number: index + 1,
    sample_name: sample.sample_name,
    project_id: sample.project_id || submission.project_id,
    submitter_name: submission.submitter_name,
    submitter_email: submission.submitter_email,
    lab_name: submission.lab_name,
    sample_type: sample.sample_type,
    sample_buffer: sample.sample_buffer || null,
    concentration: sample.concentration || null,
    volume: sample.volume || null,
    total_amount: (sample.concentration && sample.volume) 
      ? sample.concentration * sample.volume 
      : null,
    flow_cell_type: sample.flow_cell_type || null,
    flow_cell_count: sample.flow_cell_count || 1,
    status: 'submitted' as const,
    priority: sample.priority || submission.priority,
    chart_field: sample.chart_field || submission.billing_account || '',
    assigned_to: null,
    library_prep_by: null,
    submitted_at: now,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    created_by: createdBy,
  }))
  
  return await db
    .insertInto('nanopore_samples')
    .values(sampleValues)
    .returningAll()
    .execute()
}

/**
 * Create a submission with samples in a transaction
 */
export async function createSubmissionWithSamples(
  db: Kysely<DB>,
  submissionData: CreateSubmissionInput & { created_by: string },
  samples: Array<Omit<CreateSampleForSubmissionInput, 'submission_id'>>,
): Promise<{
  submission: Selectable<DB['nanopore_submissions']>
  samples: Array<Selectable<DB['nanopore_samples']>>
}> {
  return await db.transaction().execute(async (trx: Transaction<DB>) => {
    // Create submission
    const submission = await createNanoporeSubmission(trx, submissionData)
    
    // Create samples for this submission
    const createdSamples = await createSamplesForSubmission(
      trx,
      submission.id,
      samples.map(s => ({ ...s, submission_id: submission.id })),
      submissionData.created_by,
    )
    
    // Update submission sample count
    await trx
      .updateTable('nanopore_submissions')
      .set({
        sample_count: createdSamples.length,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', submission.id)
      .execute()
    
    return {
      submission,
      samples: createdSamples,
    }
  })
}

/**
 * Delete a submission (and all its samples via CASCADE)
 */
export async function deleteNanoporeSubmission(
  db: Kysely<DB>,
  submissionId: string,
): Promise<void> {
  await db
    .deleteFrom('nanopore_submissions')
    .where('id', '=', submissionId)
    .execute()
}

/**
 * Update submission status
 */
export async function updateSubmissionStatus(
  db: Kysely<DB>,
  submissionId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
): Promise<Selectable<DB['nanopore_submissions']>> {
  const now = new Date().toISOString()
  
  return await db
    .updateTable('nanopore_submissions')
    .set({
      status,
      updated_at: now,
    })
    .where('id', '=', submissionId)
    .returningAll()
    .executeTakeFirstOrThrow()
} 