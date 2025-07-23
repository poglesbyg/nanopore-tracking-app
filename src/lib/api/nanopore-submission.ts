import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { 
  getAllSubmissionsWithCounts,
  getNanoporeSubmissionById,
  getNanoporeSubmissionWithSamples,
  getSubmissionsPaginated,
  getSubmissionStats,
  searchSubmissions
} from './nanopore/submission-getters'
import {
  createNanoporeSubmission,
  updateNanoporeSubmission,
  createSubmissionWithSamples,
  deleteNanoporeSubmission,
  updateSubmissionStatus
} from './nanopore/submission-setters'
import type { CreateSubmissionInput, UpdateSubmissionInput, PDFProcessingResult } from '@/types/nanopore-submission'

// Validation schemas
const createSubmissionValidation = z.object({
  pdf_filename: z.string().min(1),
  submitter_name: z.string().min(1),
  submitter_email: z.string().email(),
  lab_name: z.string().optional(),
  department: z.string().optional(),
  billing_account: z.string().optional(),
  project_id: z.string().optional(),
  project_name: z.string().optional(),
  special_instructions: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  pdf_metadata: z.any().optional(),
  extracted_data: z.any().optional(),
  extraction_method: z.enum(['llm', 'pattern', 'hybrid', 'rag']).optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
})

const updateSubmissionValidation = z.object({
  submitter_name: z.string().min(1).optional(),
  submitter_email: z.string().email().optional(),
  lab_name: z.string().optional(),
  department: z.string().optional(),
  billing_account: z.string().optional(),
  project_id: z.string().optional(),
  project_name: z.string().optional(),
  special_instructions: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
})

const sampleForSubmissionValidation = z.object({
  sample_name: z.string().min(1),
  sample_type: z.enum(['DNA', 'RNA', 'Protein', 'Other']),
  concentration: z.number().positive().optional(),
  volume: z.number().positive().optional(),
  flow_cell_type: z.enum(['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other']).optional(),
  flow_cell_count: z.number().int().positive().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  chart_field: z.string().optional(),
  sample_buffer: z.string().optional(),
})

const createSubmissionWithSamplesValidation = z.object({
  submission: createSubmissionValidation,
  samples: z.array(sampleForSubmissionValidation).min(1),
})

export const nanoporeSubmissionRouter = router({
  // Get all submissions
  getAll: publicProcedure.query(async ({ ctx }) => {
    try {
      return await getAllSubmissionsWithCounts(ctx.db, ctx.userId || undefined)
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch submissions',
        cause: error,
      })
    }
  }),

  // Get submissions with pagination
  getAllPaginated: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      sortBy: z.enum(['submission_date', 'submission_number', 'status', 'priority']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        return await getSubmissionsPaginated(ctx.db, {
          ...input,
          userId: ctx.userId || undefined,
        })
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch submissions',
          cause: error,
        })
      }
    }),

  // Get submission by ID
  getById: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        // For now, use a dummy user ID until auth is implemented
        const userId = ctx.userId || 'default-user'
        const submission = await getNanoporeSubmissionById(ctx.db, input.id, userId)
        
        if (!submission) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          })
        }
        
        return submission
      } catch (error) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch submission',
          cause: error,
        })
      }
    }),

  // Get submission with samples
  getWithSamples: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId || 'default-user'
        const submission = await getNanoporeSubmissionWithSamples(ctx.db, input.id, userId)
        
        if (!submission) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          })
        }
        
        return submission
      } catch (error) {
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch submission with samples',
          cause: error,
        })
      }
    }),

  // Get submission statistics
  getStats: publicProcedure.query(async ({ ctx }) => {
    try {
      return await getSubmissionStats(ctx.db, ctx.userId || undefined)
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch submission statistics',
        cause: error,
      })
    }
  }),

  // Create submission
  create: publicProcedure
    .input(createSubmissionValidation)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId || 'default-user'
        return await createNanoporeSubmission(ctx.db, {
          ...input,
          created_by: userId,
        })
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create submission',
          cause: error,
        })
      }
    }),

  // Create submission with samples
  createWithSamples: publicProcedure
    .input(createSubmissionWithSamplesValidation)
    .mutation(async ({ input, ctx }) => {
      try {
        const userId = ctx.userId || 'default-user'
        return await createSubmissionWithSamples(
          ctx.db,
          {
            ...input.submission,
            created_by: userId,
          },
          input.samples
        )
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create submission with samples',
          cause: error,
        })
      }
    }),

  // Update submission
  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateSubmissionValidation,
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await updateNanoporeSubmission(ctx.db, input.id, input.data)
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update submission',
          cause: error,
        })
      }
    }),

  // Update submission status
  updateStatus: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['pending', 'processing', 'completed', 'failed']),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await updateSubmissionStatus(ctx.db, input.id, input.status)
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update submission status',
          cause: error,
        })
      }
    }),

  // Delete submission
  delete: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await deleteNanoporeSubmission(ctx.db, input.id)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete submission',
          cause: error,
        })
      }
    }),

  // Search submissions
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
    }))
    .query(async ({ input, ctx }) => {
      try {
        return await searchSubmissions(ctx.db, input.query, ctx.userId || undefined)
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search submissions',
          cause: error,
        })
      }
    }),
}) 