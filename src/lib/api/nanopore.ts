import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'

// Valid chart fields for intake validation
const VALID_CHART_FIELDS = [
  'HTSF-001', 'HTSF-002', 'HTSF-003', 'HTSF-004', 'HTSF-005',
  'NANO-001', 'NANO-002', 'NANO-003', 'NANO-004', 'NANO-005',
  'SEQ-001', 'SEQ-002', 'SEQ-003', 'SEQ-004', 'SEQ-005'
]

function validateChartField(chartField: string): boolean {
  return VALID_CHART_FIELDS.includes(chartField)
}

const createNanoporeSampleSchema = z.object({
  sampleName: z.string().min(1, 'Sample name is required').max(255),
  projectId: z.string().optional(),
  submitterName: z.string().min(1, 'Submitter name is required').max(255),
  submitterEmail: z.string().email('Invalid email address'),
  labName: z.string().optional(),
  sampleType: z.string().min(1, 'Sample type is required'),
  sampleBuffer: z.string().optional(),
  concentration: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  totalAmount: z.number().positive().optional(),
  flowCellType: z.string().optional(),
  flowCellCount: z.number().int().positive().default(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedTo: z.string().optional(),
  libraryPrepBy: z.string().optional(),
  chartField: z.string().min(1, 'Chart field is required for intake validation').max(255),
})

const updateNanoporeSampleSchema = z.object({
  sampleName: z.string().max(255).optional(),
  projectId: z.string().optional(),
  submitterName: z.string().max(255).optional(),
  submitterEmail: z.string().email().optional(),
  labName: z.string().optional(),
  sampleType: z.string().optional(),
  sampleBuffer: z.string().optional(),
  concentration: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  totalAmount: z.number().positive().optional(),
  flowCellType: z.string().optional(),
  flowCellCount: z.number().int().positive().optional(),
  status: z.enum(['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedTo: z.string().optional(),
  libraryPrepBy: z.string().optional(),
})

export const nanoporeRouter = router({
  // Get all nanopore samples
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .selectFrom('nanopore_samples')
      .selectAll()
      .orderBy('submitted_at', 'desc')
      .execute()
  }),

  // Create new nanopore sample
  create: publicProcedure
    .input(createNanoporeSampleSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate chart field before creating the sample
      if (!validateChartField(input.chartField)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid chart field: ${input.chartField}. Chart field must be part of the intake validation list.`,
        })
      }

      const now = new Date()
      return await ctx.db
        .insertInto('nanopore_samples')
        .values({
          id: crypto.randomUUID(),
          sample_name: input.sampleName,
          project_id: input.projectId || null,
          submitter_name: input.submitterName,
          submitter_email: input.submitterEmail,
          lab_name: input.labName || null,
          sample_type: input.sampleType,
          sample_buffer: input.sampleBuffer || null,
          concentration: input.concentration || null,
          volume: input.volume || null,
          total_amount: input.totalAmount || null,
          flow_cell_type: input.flowCellType || null,
          flow_cell_count: input.flowCellCount,
          status: 'submitted',
          priority: input.priority,
          assigned_to: input.assignedTo || null,
          library_prep_by: input.libraryPrepBy || null,
          chart_field: input.chartField,
          submitted_at: now,
          created_at: now,
          updated_at: now,
          created_by: 'demo-user',
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    }),

  // Update nanopore sample
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateNanoporeSampleSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updateData: any = {}
      
      if (input.data.sampleName !== undefined) updateData.sample_name = input.data.sampleName
      if (input.data.projectId !== undefined) updateData.project_id = input.data.projectId
      if (input.data.submitterName !== undefined) updateData.submitter_name = input.data.submitterName
      if (input.data.submitterEmail !== undefined) updateData.submitter_email = input.data.submitterEmail
      if (input.data.labName !== undefined) updateData.lab_name = input.data.labName
      if (input.data.sampleType !== undefined) updateData.sample_type = input.data.sampleType
      if (input.data.sampleBuffer !== undefined) updateData.sample_buffer = input.data.sampleBuffer
      if (input.data.concentration !== undefined) updateData.concentration = input.data.concentration
      if (input.data.volume !== undefined) updateData.volume = input.data.volume
      if (input.data.totalAmount !== undefined) updateData.total_amount = input.data.totalAmount
      if (input.data.flowCellType !== undefined) updateData.flow_cell_type = input.data.flowCellType
      if (input.data.flowCellCount !== undefined) updateData.flow_cell_count = input.data.flowCellCount
      if (input.data.status !== undefined) updateData.status = input.data.status
      if (input.data.priority !== undefined) updateData.priority = input.data.priority
      if (input.data.assignedTo !== undefined) updateData.assigned_to = input.data.assignedTo
      if (input.data.libraryPrepBy !== undefined) updateData.library_prep_by = input.data.libraryPrepBy
      
      updateData.updated_at = new Date()

      return await ctx.db
        .updateTable('nanopore_samples')
        .set(updateData)
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    }),

  // Assign sample to team member
  assign: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assignedTo: z.string(),
        libraryPrepBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db
        .updateTable('nanopore_samples')
        .set({
          assigned_to: input.assignedTo,
          library_prep_by: input.libraryPrepBy || null,
          updated_at: new Date(),
        })
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    }),

  // Update sample status
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'archived']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updateData: any = {
        status: input.status,
        updated_at: new Date(),
      }
      
      // Add timestamps for specific status changes
      if (input.status === 'prep') {
        updateData.started_at = new Date()
      } else if (input.status === 'completed') {
        updateData.completed_at = new Date()
      }

      return await ctx.db
        .updateTable('nanopore_samples')
        .set(updateData)
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    }),

  // Delete sample
  delete: publicProcedure
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .deleteFrom('nanopore_samples')
        .where('id', '=', input)
        .executeTakeFirst()
      
      if (result.numDeletedRows === 0n) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sample not found',
        })
      }
      
      return { success: true }
    }),
})
