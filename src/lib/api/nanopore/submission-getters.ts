import type { DB } from '../../db/types'
import type { Selectable, Kysely, ExpressionBuilder } from 'kysely'
import type { NanoporeSubmission, NanoporeSampleWithSubmission } from '@/types/nanopore-submission'

/**
 * Get all nanopore submissions
 */
export async function getAllNanoporeSubmissions(
  db: Kysely<DB>,
): Promise<Array<Selectable<DB['nanopore_submissions']>>> {
  return await db
    .selectFrom('nanopore_submissions')
    .selectAll()
    .orderBy('submission_date', 'desc')
    .execute()
}

/**
 * Get submission by ID
 */
export async function getNanoporeSubmissionById(
  db: Kysely<DB>,
  submissionId: string,
  userId: string,
): Promise<Selectable<DB['nanopore_submissions']> | null> {
  return await db
    .selectFrom('nanopore_submissions')
    .selectAll()
    .where('id', '=', submissionId)
    .where('created_by', '=', userId)
    .executeTakeFirst() || null
}

/**
 * Get submission with all its samples
 */
export async function getNanoporeSubmissionWithSamples(
  db: Kysely<DB>,
  submissionId: string,
  userId: string,
): Promise<(Selectable<DB['nanopore_submissions']> & { samples: Array<Selectable<DB['nanopore_samples']>> }) | null> {
  const submission = await getNanoporeSubmissionById(db, submissionId, userId)
  
  if (!submission) {
    return null
  }
  
  const samples = await db
    .selectFrom('nanopore_samples')
    .selectAll()
    .where('submission_id', '=', submissionId)
    .orderBy('sample_number', 'asc')
    .execute()
  
  return {
    ...submission,
    samples,
  }
}

/**
 * Get all submissions with their sample counts
 */
export async function getAllSubmissionsWithCounts(
  db: Kysely<DB>,
  userId?: string,
): Promise<Array<Selectable<DB['nanopore_submissions']>>> {
  let query = db
    .selectFrom('nanopore_submissions')
    .selectAll()
  
  if (userId) {
    query = query.where('created_by', '=', userId)
  }
  
  return await query
    .orderBy('submission_date', 'desc')
    .execute()
}

/**
 * Get submissions by status
 */
export async function getSubmissionsByStatus(
  db: Kysely<DB>,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  userId?: string,
): Promise<Array<Selectable<DB['nanopore_submissions']>>> {
  let query = db
    .selectFrom('nanopore_submissions')
    .selectAll()
    .where('status', '=', status)
  
  if (userId) {
    query = query.where('created_by', '=', userId)
  }
  
  return await query
    .orderBy('submission_date', 'desc')
    .execute()
}

/**
 * Search submissions
 */
export async function searchSubmissions(
  db: Kysely<DB>,
  searchTerm: string,
  userId?: string,
): Promise<Array<Selectable<DB['nanopore_submissions']>>> {
  let query = db
    .selectFrom('nanopore_submissions')
    .selectAll()
    .where((eb: ExpressionBuilder<DB, 'nanopore_submissions'>) => eb.or([
      eb('submission_number', 'ilike', `%${searchTerm}%`),
      eb('submitter_name', 'ilike', `%${searchTerm}%`),
      eb('submitter_email', 'ilike', `%${searchTerm}%`),
      eb('lab_name', 'ilike', `%${searchTerm}%`),
      eb('project_name', 'ilike', `%${searchTerm}%`),
    ]))
  
  if (userId) {
    query = query.where('created_by', '=', userId)
  }
  
  return await query
    .orderBy('submission_date', 'desc')
    .execute()
}

/**
 * Get submission statistics
 */
export async function getSubmissionStats(
  db: Kysely<DB>,
  userId?: string,
): Promise<{
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  totalSamples: number
}> {
  let submissionQuery = db
    .selectFrom('nanopore_submissions')
  
  if (userId) {
    submissionQuery = submissionQuery.where('created_by', '=', userId)
  }
  
  const [
    totalSubmissions,
    pendingSubmissions,
    processingSubmissions,
    completedSubmissions,
    failedSubmissions,
    totalSamples,
  ] = await Promise.all([
    submissionQuery.select(db.fn.count<number>('id').as('count')).executeTakeFirst(),
    submissionQuery.select(db.fn.count<number>('id').as('count')).where('status', '=', 'pending').executeTakeFirst(),
    submissionQuery.select(db.fn.count<number>('id').as('count')).where('status', '=', 'processing').executeTakeFirst(),
    submissionQuery.select(db.fn.count<number>('id').as('count')).where('status', '=', 'completed').executeTakeFirst(),
    submissionQuery.select(db.fn.count<number>('id').as('count')).where('status', '=', 'failed').executeTakeFirst(),
    db
      .selectFrom('nanopore_samples')
      .select(db.fn.count<number>('id').as('count'))
      .where('submission_id', 'in', 
        submissionQuery.select('id')
      )
      .executeTakeFirst(),
  ])
  
  return {
    total: totalSubmissions?.count || 0,
    pending: pendingSubmissions?.count || 0,
    processing: processingSubmissions?.count || 0,
    completed: completedSubmissions?.count || 0,
    failed: failedSubmissions?.count || 0,
    totalSamples: totalSamples?.count || 0,
  }
}

/**
 * Get submissions with paginated results
 */
export async function getSubmissionsPaginated(
  db: Kysely<DB>,
  options: {
    page: number
    limit: number
    search?: string
    status?: 'pending' | 'processing' | 'completed' | 'failed'
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    sortBy?: 'submission_date' | 'submission_number' | 'status' | 'priority'
    sortOrder?: 'asc' | 'desc'
    userId?: string
  },
): Promise<{
  data: Array<Selectable<DB['nanopore_submissions']>>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}> {
  const { page, limit, search, status, priority, sortBy = 'submission_date', sortOrder = 'desc', userId } = options
  const offset = (page - 1) * limit
  
  let query = db.selectFrom('nanopore_submissions')
  let countQuery = db.selectFrom('nanopore_submissions')
  
  // Apply filters
  if (userId) {
    query = query.where('created_by', '=', userId)
    countQuery = countQuery.where('created_by', '=', userId)
  }
  
  if (search) {
    const searchCondition = (eb: ExpressionBuilder<DB, 'nanopore_submissions'>) => eb.or([
      eb('submission_number', 'ilike', `%${search}%`),
      eb('submitter_name', 'ilike', `%${search}%`),
      eb('submitter_email', 'ilike', `%${search}%`),
      eb('lab_name', 'ilike', `%${search}%`),
      eb('project_name', 'ilike', `%${search}%`),
    ])
    query = query.where(searchCondition)
    countQuery = countQuery.where(searchCondition)
  }
  
  if (status) {
    query = query.where('status', '=', status)
    countQuery = countQuery.where('status', '=', status)
  }
  
  if (priority) {
    query = query.where('priority', '=', priority)
    countQuery = countQuery.where('priority', '=', priority)
  }
  
  // Get total count
  const totalResult = await countQuery
    .select(db.fn.count<number>('id').as('count'))
    .executeTakeFirst()
  
  const total = totalResult?.count || 0
  const totalPages = Math.ceil(total / limit)
  
  // Get paginated data
  const data = await query
    .selectAll()
    .orderBy(sortBy, sortOrder)
    .limit(limit)
    .offset(offset)
    .execute()
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
} 