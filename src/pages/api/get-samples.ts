import type { APIRoute } from 'astro'
import { getSampleService } from '../../container'

export const GET: APIRoute = async () => {
  try {
    const sampleService = getSampleService()
    const samples = await sampleService.getAllSamples()
    
    return new Response(JSON.stringify({
      success: true,
      data: samples || [],
      message: 'Samples retrieved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
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