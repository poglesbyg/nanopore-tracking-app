import { ResponseInit } from 'astro'

interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

function json<T>(payload: ApiResponse<T>, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  } as ResponseInit)
}

export function ok<T>(data: T, message = 'OK', status = 200) {
  return json<T>({ success: true, message, data }, status)
}

export function created<T>(data: T, message = 'Created') {
  return json<T>({ success: true, message, data }, 201)
}

export function badRequest(message: string, errors?: string[]) {
  return json({ success: false, message, errors }, 400)
}

export function notFound(message = 'Not found') {
  return json({ success: false, message }, 404)
}

export function internalError(message = 'Internal server error', errors?: string[]) {
  return json({ success: false, message, errors }, 500)
}
