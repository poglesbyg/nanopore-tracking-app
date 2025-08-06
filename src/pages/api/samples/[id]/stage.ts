import type { APIRoute } from 'astro'
import { db } from '../../../../lib/database'
import { canTransition, WORKFLOW_SEQUENCE, WorkflowStage } from '../../../../lib/nanopore/processing-steps'

/**
 * PATCH /api/samples/:id/stage
 * Body: { target_stage: WorkflowStage }
 */
export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params
    if (!id) {
      return new Response(JSON.stringify({ success: false, message: 'Sample id missing' }), { status: 400 })
    }

    const body = await request.json()
    const { target_stage } = body as { target_stage: WorkflowStage }

    if (!target_stage || !WORKFLOW_SEQUENCE.includes(target_stage)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid target_stage' }), { status: 400 })
    }

    const sample = await db
      .selectFrom('nanopore_samples')
      .select(['id', 'workflow_stage'])
      .where('id', '=', id)
      .executeTakeFirst()

    if (!sample) {
      return new Response(JSON.stringify({ success: false, message: 'Sample not found' }), { status: 404 })
    }

    const currentStage = sample.workflow_stage as WorkflowStage
    if (!canTransition(currentStage, target_stage)) {
      return new Response(JSON.stringify({ success: false, message: `Cannot transition from ${currentStage} to ${target_stage}` }), { status: 400 })
    }

    const updated = await db
      .updateTable('nanopore_samples')
      .set({ workflow_stage: target_stage, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return new Response(JSON.stringify({ success: true, data: updated, message: 'Stage updated' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Stage update error:', error)
    return new Response(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Failed to update stage' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
