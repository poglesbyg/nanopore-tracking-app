import type { APIRoute } from 'astro'
import { db } from '../../lib/database'
import { randomUUID } from 'crypto'

// GET /api/submissions?project_id=xxx - List submissions for a project
export const GET: APIRoute = async ({ url }) => {
  try {
    const project_id = url.searchParams.get('project_id')
    
    let query = db.selectFrom('submissions')
      .selectAll()
      .orderBy('created_at', 'desc')

    if (project_id) {
      query = query.where('project_id', '=', project_id)
    }

    const result = await query.execute()
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Submissions retrieved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get submissions error:', error)
    return new Response(JSON.stringify({
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to retrieve submissions'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST /api/submissions - Create new submission
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json()
    const {
      project_id,
      name,
      description,
      submitter_name,
      submitter_email,
      submission_type = 'manual',
      priority = 'normal',
      original_filename,
      file_size_bytes
    } = data

    // Validate required fields
    if (!project_id || !name || !submitter_name || !submitter_email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: project_id, name, submitter_name, submitter_email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify project exists
    const project = await db.selectFrom('projects')
      .select('id')
      .where('id', '=', project_id)
      .executeTakeFirst()

    if (!project) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Project not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await db.insertInto('submissions')
      .values({
        id: randomUUID(),
        project_id,
        name,
        description,
        submitter_name,
        submitter_email,
        submission_type,
        priority,
        original_filename,
        file_size_bytes,
        status: 'draft',
        submitted_at: submission_type === 'manual' ? new Date() : undefined,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Submission created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Create submission error:', error)
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create submission'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}