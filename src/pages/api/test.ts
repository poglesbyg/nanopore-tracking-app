import type { APIRoute } from 'astro'

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'API is working!'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}