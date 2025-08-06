import type { APIRoute } from 'astro'
import { db } from '../../lib/database'

// GET /api/projects - List all projects
export const GET: APIRoute = async () => {
  try {
    const result = await db.selectFrom('projects')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute()
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Projects retrieved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get projects error:', error)
    return new Response(JSON.stringify({
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to retrieve projects'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST /api/projects - Create new project
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json()
    const {
      name,
      description,
      owner_name,
      owner_email,
      chart_prefix = 'PROJ'
    } = data

    // Validate required fields
    if (!name || !owner_name || !owner_email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: name, owner_name, owner_email'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await db.insertInto('projects')
      .values({
        name,
        description,
        owner_name,
        owner_email,
        chart_prefix,
        status: 'active'
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Project created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Create project error:', error)
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create project'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}