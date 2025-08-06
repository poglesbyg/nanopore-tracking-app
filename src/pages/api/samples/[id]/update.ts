import type { APIRoute } from 'astro'
import { db } from '../../../../lib/database'
import { ok, badRequest, notFound, internalError } from '../../../../lib/api/server-response'
import { z } from 'zod'

const updateSampleSchema = z.object({
  sample_name: z.string().min(1).max(255).optional(),
  sample_type: z.enum(['DNA', 'RNA', 'Protein', 'Other']).optional(),
  concentration: z.string().optional(),
  concentration_unit: z.string().optional(),
  volume: z.string().optional(),
  volume_unit: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'failed', 'archived']).optional(),
  lab_name: z.string().max(255).optional(),
  chart_field: z.string().max(50).optional(),
  submitter_name: z.string().max(255).optional(),
  submitter_email: z.string().email().optional(),
})

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const sampleId = params.id
    if (!sampleId) {
      return badRequest('Sample ID is required')
    }

    const body = await request.json()
    const validationResult = updateSampleSchema.safeParse(body)
    
    if (!validationResult.success) {
      return badRequest('Invalid sample data', validationResult.error.errors.map(e => e.message))
    }

    const updateData = validationResult.data

    // Check if sample exists
    const existingSample = await db
      .selectFrom('nanopore_samples')
      .select(['id'])
      .where('id', '=', sampleId)
      .executeTakeFirst()

    if (!existingSample) {
      return notFound('Sample not found')
    }

    // Filter out undefined values for the update
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    )

    if (Object.keys(fieldsToUpdate).length === 0) {
      return badRequest('No valid fields to update')
    }

    // Add updated_at timestamp
    fieldsToUpdate.updated_at = new Date().toISOString()

    // Update the sample
    await db
      .updateTable('nanopore_samples')
      .set(fieldsToUpdate)
      .where('id', '=', sampleId)
      .execute()

    // Fetch the updated sample
    const updatedSample = await db
      .selectFrom('nanopore_samples')
      .selectAll()
      .where('id', '=', sampleId)
      .executeTakeFirstOrThrow()

    return ok(updatedSample, 'Sample updated successfully')

  } catch (error) {
    console.error('Error updating sample:', error)
    return internalError('Failed to update sample')
  }
}