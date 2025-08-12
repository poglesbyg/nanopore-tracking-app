import type { APIRoute } from 'astro'
import { db } from '@/lib/database'

export const GET: APIRoute = async () => {
  try {
    
    // Fetch all submissions with their sample count
    const submissions = await db
      .selectFrom('submissions')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute()
    
    // For each submission, fetch its samples
    const submissionsWithSamples = await Promise.all(
      submissions.map(async (submission: any) => {
        const samples = await db
          .selectFrom('nanopore_samples')
          .selectAll()
          .where('submission_id', '=', submission.id)
          .orderBy('sample_number', 'asc')
          .execute()
        
        return {
          ...submission,
          samples
        }
      })
    )
    
    return new Response(JSON.stringify({
      success: true,
      data: submissionsWithSamples
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
} 