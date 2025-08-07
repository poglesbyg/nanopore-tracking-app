import type { APIRoute } from 'astro'
import { db } from '../../../../lib/database'

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params?.id
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sample id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const sample = await db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (!sample) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sample not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: sample, message: 'Sample retrieved successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Get sample by id error:', error)
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Failed to retrieve sample' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}


