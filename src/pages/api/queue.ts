import type { APIRoute } from 'astro'
import { sql } from 'kysely'
import { db } from '../../lib/database'
import { ok, internalError } from '../../lib/api/server-response'

const PRIORITY_SQL = `CASE priority 
  WHEN 'urgent' THEN 1
  WHEN 'high' THEN 2
  WHEN 'normal' THEN 3
  ELSE 4
END`

// GET /api/queue - list pending samples ordered by priority
export const GET: APIRoute = async () => {
  try {
    const items = await db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('status', '=', 'submitted')
      .orderBy(sql.raw(PRIORITY_SQL))
      .orderBy('created_at', 'asc')
      .execute()

    return ok(items, 'Queue retrieved')
  } catch (error) {
    console.error('Queue retrieval error:', error)
    return internalError('Failed to retrieve queue')
  }
}
