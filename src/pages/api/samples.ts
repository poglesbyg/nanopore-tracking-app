import type { APIRoute } from 'astro'
import { db } from '../../lib/database'
import { validateSampleQC } from '../../lib/nanopore/processing-steps'
import { ok } from '../../lib/api/server-response'
import { randomUUID } from 'crypto'

// GET /api/samples?submission_id=xxx - List samples for a submission
export const GET: APIRoute = async ({ url }) => {
  try {
    const submission_id = url.searchParams.get('submission_id')
    
    let query = db.selectFrom('nanopore_samples')
      .selectAll()
      .orderBy('created_at', 'desc')

    if (submission_id) {
      query = query.where('submission_id', '=', submission_id)
    }

    const result = await query.execute()
    
    return ok(result, 'Samples retrieved successfully')
  } catch (error) {
    console.error('Get samples error:', error)
    return new Response(JSON.stringify({
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to retrieve samples'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST /api/samples - Create new sample under a submission
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json()
    const {
      submission_id,
      sample_name,
      sample_id,
      submitter_name,
      submitter_email,
      lab_name = 'Default Lab',
      sample_type = 'DNA',
      chart_field = 'HTSF-001',
      priority = 'normal',
      concentration,
      concentration_unit = 'ng/μL',
      volume,
      volume_unit = 'μL'
    } = data

    // Parse numeric values safely
    const concentrationNum = concentration !== undefined && concentration !== null ? parseFloat(concentration) : null
    const volumeNum = volume !== undefined && volume !== null ? parseFloat(volume) : null

    // Validate required fields
    if (!submission_id || !sample_name || !sample_id || !submitter_name || !submitter_email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: submission_id, sample_name, sample_id, submitter_name, submitter_email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate Sample QC (concentration & volume)
    const validation = validateSampleQC({
      sample_type,
      concentration: concentrationNum,
      volume: volumeNum
    })

    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Sample validation failed',
        errors: validation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify submission exists
    const submission = await db.selectFrom('submissions')
      .select(['id'])
      .where('id', '=', submission_id)
      .executeTakeFirst()

    if (!submission) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Submission not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await db.insertInto('nanopore_samples')
      .values({
        id: randomUUID(),
        submission_id,
        sample_name,
        sample_number: 1, // Default to 1, should be calculated based on existing samples in submission
        sample_id,
        submitter_name,
        submitter_email,
        lab_name,
        sample_type,
        chart_field,
        priority,
        concentration: concentrationNum,
        concentration_unit,
        volume: volumeNum,
        volume_unit,
        workflow_stage: 'sample_qc',
        status: 'submitted',
        flow_cell_count: 1,
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Sample created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Create sample error:', error)
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create sample'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}