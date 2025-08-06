import type { APIRoute } from 'astro'
import { db } from '../../../lib/database'
import { ok, badRequest, internalError } from '../../../lib/api/server-response'
import { z } from 'zod'

const bulkOperationSchema = z.object({
  operation: z.enum(['update_status', 'update_priority', 'update_workflow_stage', 'assign_lab', 'batch_process']),
  sample_ids: z.array(z.string()).min(1, 'At least one sample ID is required'),
  data: z.object({
    status: z.enum(['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'failed', 'archived']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    workflow_stage: z.enum(['sample_qc', 'library_prep', 'library_qc', 'sequencing_setup', 'sequencing_run', 'basecalling', 'quality_assessment', 'data_delivery']).optional(),
    lab_name: z.string().max(255).optional(),
    submitter_name: z.string().max(255).optional(),
    submitter_email: z.string().email().optional(),
    batch_notes: z.string().max(1000).optional(),
  }).optional()
})

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const validationResult = bulkOperationSchema.safeParse(body)
    
    if (!validationResult.success) {
      return badRequest('Invalid bulk operation data', validationResult.error.errors.map(e => e.message))
    }

    const { operation, sample_ids, data } = validationResult.data
    const timestamp = new Date().toISOString()

    // Verify all samples exist
    const existingSamples = await db
      .selectFrom('nanopore_samples')
      .select(['id', 'sample_name', 'status', 'priority', 'workflow_stage'])
      .where('id', 'in', sample_ids)
      .execute()

    if (existingSamples.length !== sample_ids.length) {
      const foundIds = existingSamples.map(s => s.id)
      const missingIds = sample_ids.filter(id => !foundIds.includes(id))
      return badRequest(`Samples not found: ${missingIds.join(', ')}`)
    }

    let updateFields: Record<string, any> = {
      updated_at: timestamp
    }

    // Build update fields based on operation
    switch (operation) {
      case 'update_status':
        if (!data?.status) {
          return badRequest('Status is required for update_status operation')
        }
        updateFields.status = data.status
        break

      case 'update_priority':
        if (!data?.priority) {
          return badRequest('Priority is required for update_priority operation')
        }
        updateFields.priority = data.priority
        break

      case 'update_workflow_stage':
        if (!data?.workflow_stage) {
          return badRequest('Workflow stage is required for update_workflow_stage operation')
        }
        updateFields.workflow_stage = data.workflow_stage
        break

      case 'assign_lab':
        if (!data?.lab_name) {
          return badRequest('Lab name is required for assign_lab operation')
        }
        updateFields.lab_name = data.lab_name
        if (data.submitter_name) updateFields.submitter_name = data.submitter_name
        if (data.submitter_email) updateFields.submitter_email = data.submitter_email
        break

      case 'batch_process':
        // Apply multiple updates at once
        if (data?.status) updateFields.status = data.status
        if (data?.priority) updateFields.priority = data.priority
        if (data?.workflow_stage) updateFields.workflow_stage = data.workflow_stage
        if (data?.lab_name) updateFields.lab_name = data.lab_name
        if (data?.submitter_name) updateFields.submitter_name = data.submitter_name
        if (data?.submitter_email) updateFields.submitter_email = data.submitter_email
        break

      default:
        return badRequest('Invalid operation type')
    }

    // Perform bulk update
    const result = await db
      .updateTable('nanopore_samples')
      .set(updateFields)
      .where('id', 'in', sample_ids)
      .execute()

    // Fetch updated samples for response
    const updatedSamples = await db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('id', 'in', sample_ids)
      .execute()

    // Create audit log entries for bulk operation
    const auditEntries = sample_ids.map(sampleId => ({
      id: crypto.randomUUID(),
      entity_type: 'sample' as const,
      entity_id: sampleId,
      action: `bulk_${operation}`,
      old_values: JSON.stringify(existingSamples.find(s => s.id === sampleId)),
      new_values: JSON.stringify(updatedSamples.find(s => s.id === sampleId)),
      user_id: 'system', // TODO: Replace with actual user ID from auth
      created_at: timestamp,
      metadata: JSON.stringify({
        operation,
        batch_size: sample_ids.length,
        notes: data?.batch_notes
      })
    }))

    // Insert audit entries (assuming audit_logs table exists)
    try {
      await db
        .insertInto('audit_logs')
        .values(auditEntries)
        .execute()
    } catch (auditError) {
      console.warn('Failed to create audit log entries:', auditError)
      // Continue with operation even if audit logging fails
    }

    return ok({
      operation,
      affected_samples: sample_ids.length,
      updated_samples: updatedSamples,
      timestamp
    }, `Bulk ${operation} completed successfully for ${sample_ids.length} samples`)

  } catch (error) {
    console.error('Error performing bulk operation:', error)
    return internalError('Failed to perform bulk operation')
  }
}