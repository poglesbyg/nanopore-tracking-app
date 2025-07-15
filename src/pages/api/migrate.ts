import type { APIRoute } from 'astro'
import { runMigrations } from '../../lib/migrate'

export const GET: APIRoute = async ({ request }) => {
  try {
    const result = await runMigrations()
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
} 