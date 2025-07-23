import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get the submission service URL from environment
    const submissionServiceUrl = process.env.SUBMISSION_SERVICE_URL || 'http://localhost:8001'
    
    // Get the form data from the request
    const formData = await request.formData()
    
    // Forward the request to the submission service
    const response = await fetch(`${submissionServiceUrl}/api/v1/process-csv`, {
      method: 'POST',
      body: formData,
      headers: {
        // Forward any auth headers if present
        'Authorization': request.headers.get('Authorization') || '',
        'X-User-Id': request.headers.get('X-User-Id') || '',
      }
    })

    // Get the response data
    const data = await response.json()

    // Transform the response to match the ProcessingResult interface
    const transformedResponse = {
      success: data.status === 'completed' || data.status === 'success',
      message: data.message || `Successfully processed CSV: ${data.metadata?.filename || 'unknown'}`,
      samples_processed: data.samples_processed || (data.data ? data.data.length : 0),
      samples_created: data.samples_created || 0,
      errors: data.errors || [],
      processing_time: data.processing_time || 0,
      // Include the original data for the frontend
      data: data.data,
      metadata: data.metadata
    }

    // Return the transformed response
    return new Response(JSON.stringify(transformedResponse), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error processing CSV:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to process CSV',
        samples_processed: 0,
        samples_created: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processing_time: 0
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
} 