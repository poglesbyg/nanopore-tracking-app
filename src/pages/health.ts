import type { APIRoute } from 'astro'

export const GET: APIRoute = async () => {
  try {
    // Basic health check response
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'nanopore-tracking-app',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
} 