import type { APIRoute } from 'astro'
import { serviceClient, testServiceConnectivity, getServiceHealth } from '../../lib/services/ServiceClient'

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'health'

    switch (action) {
      case 'health':
        const health = getServiceHealth() as Map<string, any>
        return new Response(JSON.stringify({
          success: true,
          data: Object.fromEntries(health)
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        })

      case 'connectivity':
        const connectivity = await testServiceConnectivity()
        return new Response(JSON.stringify({
          success: true,
          data: connectivity
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        })

      case 'test':
        const serviceName = url.searchParams.get('service')
        if (!serviceName) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Service name is required for test action'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }

        try {
          const result = await serviceClient.callService(serviceName, '/health')
          return new Response(JSON.stringify({
            success: true,
            data: result
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: (error as Error).message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action. Use: health, connectivity, or test'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        })
    }
  } catch (error) {
    console.error('Service health API error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
} 