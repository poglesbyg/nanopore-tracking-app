import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get the submission service URL from environment
    const submissionServiceUrl = process.env.SUBMISSION_SERVICE_URL || 'http://localhost:8000'
    
    // Forward the request to the submission service
    const response = await fetch(`${submissionServiceUrl}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    })

    // Get the response data
    const data = await response.json()

    // Return the response with the same status code
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error checking submission service health:', error)
    return new Response(
      JSON.stringify({
        status: 'error',
        service: 'submission-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
} 