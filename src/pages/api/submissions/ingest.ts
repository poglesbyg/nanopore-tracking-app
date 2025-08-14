import type { APIRoute } from 'astro'
import { db } from '@/lib/database'
import { randomUUID } from 'crypto'

/**
 * Ingest a parsed submission and its samples in a single request.
 * Request body shape:
 * {
 *   submission: { pdf_filename, submitter_name, submitter_email, ... },
 *   samples: Array<{ sample_name, concentration?, volume?, ... }>
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json()
    const submissionInput = payload?.submission || {}
    const samples: any[] = Array.isArray(payload?.samples) ? payload.samples : []

    const errors: string[] = []

    // Basic validation
    if (!submissionInput?.pdf_filename) {
      return new Response(JSON.stringify({
        success: false,
        message: 'pdf_filename is required',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Create submission
    const submission = await (db as any)
      .insertInto('nanopore_submissions')
      .values({
        submission_number: submissionInput.submission_number || `SUB-${Date.now()}`,
        pdf_filename: submissionInput.pdf_filename,
        submitter_name: submissionInput.submitter_name || 'Unknown',
        submitter_email: submissionInput.submitter_email || 'unknown@email.com',
        lab_name: submissionInput.lab_name || null,
        department: submissionInput.department || null,
        // Note: some clusters may not have billing_account column; omit here
        submission_date: new Date(),
        project_id: submissionInput.project_id || null,
        project_name: submissionInput.project_name || null,
        status: 'processing',
        sample_count: 0,
        samples_completed: 0,
        pdf_metadata: submissionInput.pdf_metadata || null,
        extracted_data: submissionInput.extracted_data || null,
        extraction_method: submissionInput.extraction_method || null,
        extraction_confidence: submissionInput.extraction_confidence || null,
        special_instructions: submissionInput.special_instructions || null,
        priority: submissionInput.priority || 'normal',
        created_by: submissionInput.created_by || '550e8400-e29b-41d4-a716-446655440000',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const submissionId = submission.id as string

    // Insert samples if provided (bulk insert)
    let samplesCreated = 0
    const now = new Date()
    const sampleValues = samples.map((s: any, idx: number) => {
      const id = randomUUID()
      return {
        id,
        submission_id: submissionId,
        sample_number: s.sample_number ?? idx + 1,
        sample_name: s.sample_name || `Sample ${idx + 1}`,
        sample_id: s.sample_id || id.slice(0, 8),
        project_id: submissionInput.project_id || null,
        submitter_name: submissionInput.submitter_name || 'Unknown',
        submitter_email: submissionInput.submitter_email || 'unknown@email.com',
        lab_name: submissionInput.lab_name || null,
        sample_type: s.sample_type || 'DNA',
        sample_buffer: s.sample_buffer || null,
        concentration: s.concentration ?? s.nanodrop_conc ?? s.qubit_conc ?? null,
        concentration_unit: s.concentration_unit || 'ng/μL',
        volume: s.volume ?? null,
        volume_unit: s.volume_unit || 'μL',
        qubit_concentration: s.qubit_conc ?? null,
        nanodrop_concentration: s.nanodrop_conc ?? null,
        a260_280_ratio: s.a260_280 ?? null,
        a260_230_ratio: s.a260_230 ?? null,
        total_amount: null,
        flow_cell_type: s.flow_cell_type || null,
        flow_cell_count: s.flow_cell_count || 1,
        workflow_stage: 'sample_qc',
        status: 'submitted',
        priority: submissionInput.priority || 'normal',
        assigned_to: null,
        library_prep_by: null,
        chart_field: submissionInput.billing_account || 'HTSF-001',
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      }
    })

    if (sampleValues.length > 0) {
      try {
        await (db as any)
          .insertInto('nanopore_samples')
          .values(sampleValues)
          .execute()
        samplesCreated = sampleValues.length
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Failed to bulk insert samples')
      }
    }

    // Update submission with counts
    await db
      .updateTable('nanopore_submissions')
      .set({ sample_count: samplesCreated, status: 'completed', updated_at: new Date() })
      .where('id', '=', submissionId)
      .execute()

    return new Response(JSON.stringify({
      success: true,
      submissionId,
      samples_processed: samples.length,
      samples_created: samplesCreated,
      errors,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to ingest submission',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}


