import type { APIRoute } from 'astro'
import { getSampleService } from '../../container'

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json()
    
    console.log('Received sample data:', data)
    
    // Extract data from the request
    const {
      sampleName,
      submitterName,
      submitterEmail,
      labName = 'Default Lab',
      sampleType = 'DNA',
      chartField = 'HTSF-001',
      priority = 'normal'
    } = data

    // Validate required fields
    if (!sampleName || !submitterName || !submitterEmail) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: sampleName, submitterName, submitterEmail'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the sample service and create the sample
    const sampleService = getSampleService()
    const result = await sampleService.createSample({
      sampleName,
      submitterName,
      submitterEmail,
      labName,
      sampleType,
      chartField,
      priority,
      projectId: 'default-project',
      flowCellCount: 1,
      sampleBuffer: 'TE'
    })
    
    console.log('Sample created successfully:', result)
    
    return new Response(JSON.stringify({
      success: true,
      data: result,
      message: 'Sample submitted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Sample submission error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}