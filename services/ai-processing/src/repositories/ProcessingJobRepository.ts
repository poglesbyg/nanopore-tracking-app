import { Kysely, sql, Insertable } from 'kysely'
import { AIProcessingDatabase, ProcessingJobTable } from '../database/schema'
import { ProcessingJob, ProcessingStatus, ProcessingType } from '../types/processing'

export class ProcessingJobRepository {
  constructor(private db: Kysely<AIProcessingDatabase>) {}

  /**
   * Create a new processing job
   */
  async createJob(job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    const insertData: Omit<Insertable<ProcessingJobTable>, 'id' | 'created_at' | 'updated_at'> = {
      sample_id: job.sampleId,
      file_name: job.fileName,
      file_path: job.filePath,
      file_size: job.fileSize,
      mime_type: job.mimeType,
      processing_type: job.processingType,
      status: job.status,
      progress: job.progress,
      result: job.result ? JSON.stringify(job.result) : undefined,
      error: job.error,
      metadata: job.metadata ? JSON.stringify(job.metadata) : undefined,
      started_at: job.startedAt,
      completed_at: job.completedAt
    }

    const result = await this.db
      .insertInto('processing_jobs')
      .values(insertData as Insertable<ProcessingJobTable>)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapDatabaseJobToJob(result)
  }

  /**
   * Get job by ID
   */
  async getJobById(id: string): Promise<ProcessingJob | null> {
    const job = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return job ? this.mapDatabaseJobToJob(job) : null
  }

  /**
   * Get jobs by sample ID
   */
  async getJobsBySampleId(sampleId: string): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .where('sample_id', '=', sampleId)
      .orderBy('created_at', 'desc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: ProcessingStatus): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .where('status', '=', status)
      .orderBy('created_at', 'desc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get jobs by processing type
   */
  async getJobsByType(type: ProcessingType): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .where('processing_type', '=', type)
      .orderBy('created_at', 'desc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get all jobs with pagination
   */
  async getAllJobs(limit: number = 50, offset: number = 0): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Update job
   */
  async updateJob(id: string, updates: Partial<ProcessingJob>): Promise<boolean> {
    const updateData: any = {}
    
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.progress !== undefined) updateData.progress = updates.progress
    if (updates.result !== undefined) updateData.result = JSON.stringify(updates.result)
    if (updates.error !== undefined) updateData.error = updates.error
    if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata)
    if (updates.startedAt !== undefined) updateData.started_at = updates.startedAt
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt

    const result = await this.db
      .updateTable('processing_jobs')
      .set(updateData)
      .where('id', '=', id)
      .executeTakeFirst()

    return (result?.numUpdatedRows ?? 0) > 0
  }

  /**
   * Update job status
   */
  async updateJobStatus(id: string, status: ProcessingStatus, progress?: number): Promise<boolean> {
    const updateData: any = { status }
    
    if (progress !== undefined) {
      updateData.progress = progress
    }

    if (status === ProcessingStatus.PROCESSING) {
      updateData.started_at = new Date()
    } else if (status === ProcessingStatus.COMPLETED || status === ProcessingStatus.FAILED) {
      updateData.completed_at = new Date()
    }

    const result = await this.db
      .updateTable('processing_jobs')
      .set(updateData)
      .where('id', '=', id)
      .executeTakeFirst()

    return (result?.numUpdatedRows ?? 0) > 0
  }

  /**
   * Update job result
   */
  async updateJobResult(id: string, result: any): Promise<boolean> {
    const updateResult = await this.db
      .updateTable('processing_jobs')
      .set({
        result: JSON.stringify(result),
        status: ProcessingStatus.COMPLETED,
        progress: 100,
        completed_at: new Date()
      })
      .where('id', '=', id)
      .executeTakeFirst()

    return updateResult.numUpdatedRows > 0
  }

  /**
   * Update job error
   */
  async updateJobError(id: string, error: string): Promise<boolean> {
    const updateResult = await this.db
      .updateTable('processing_jobs')
      .set({
        error,
        status: ProcessingStatus.FAILED,
        completed_at: new Date()
      })
      .where('id', '=', id)
      .executeTakeFirst()

    return updateResult.numUpdatedRows > 0
  }

  /**
   * Update job progress
   */
  async updateJobProgress(id: string, progress: number): Promise<boolean> {
    const updateResult = await this.db
      .updateTable('processing_jobs')
      .set({ progress })
      .where('id', '=', id)
      .executeTakeFirst()

    return updateResult.numUpdatedRows > 0
  }

  /**
   * Delete job by ID
   */
  async deleteJob(id: string): Promise<boolean> {
    const deleteResult = await this.db
      .deleteFrom('processing_jobs')
      .where('id', '=', id)
      .executeTakeFirst()

    return deleteResult.numDeletedRows > 0
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(): Promise<{
    totalJobs: number
    jobsByStatus: Record<string, number>
    jobsByType: Record<string, number>
    recentJobs: number
    averageProcessingTime: number
  }> {
    // Get total jobs count
    const totalJobsResult = await this.db
      .selectFrom('processing_jobs')
      .select(this.db.fn.count('id').as('count'))
      .executeTakeFirst()

    const totalJobs = Number(totalJobsResult?.count || 0)

    // Get jobs by status
    const jobsByStatusResult = await this.db
      .selectFrom('processing_jobs')
      .select(['status', this.db.fn.count('id').as('count')])
      .groupBy('status')
      .execute()

    const jobsByStatus: Record<string, number> = {}
    for (const row of jobsByStatusResult) {
      jobsByStatus[row.status] = Number(row.count)
    }

    // Get jobs by type
    const jobsByTypeResult = await this.db
      .selectFrom('processing_jobs')
      .select(['processing_type', this.db.fn.count('id').as('count')])
      .groupBy('processing_type')
      .execute()

    const jobsByType: Record<string, number> = {}
    for (const row of jobsByTypeResult) {
      jobsByType[row.processing_type] = Number(row.count)
    }

    // Get recent jobs (last 7 days)
    const recentJobsResult = await this.db
      .selectFrom('processing_jobs')
      .select(this.db.fn.count('id').as('count'))
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .executeTakeFirst()

    const recentJobs = Number(recentJobsResult?.count || 0)

    // Calculate average processing time for completed jobs
    const avgProcessingTimeResult = await this.db
      .selectFrom('processing_jobs')
      .select(
        sql<number>`AVG(EXTRACT(EPOCH FROM completed_at) - EXTRACT(EPOCH FROM started_at))`.as('avg_time')
      )
      .where('status', '=', ProcessingStatus.COMPLETED)
      .where('started_at', 'is not', null)
      .where('completed_at', 'is not', null)
      .executeTakeFirst()

    const averageProcessingTime = Number(avgProcessingTimeResult?.avg_time || 0)

    return {
      totalJobs,
      jobsByStatus,
      jobsByType,
      recentJobs,
      averageProcessingTime
    }
  }

  /**
   * Get pending jobs for processing
   */
  async getPendingJobs(limit: number = 10): Promise<ProcessingJob[]> {
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .where('status', '=', ProcessingStatus.PENDING)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Get stuck jobs (processing for too long)
   */
  async getStuckJobs(timeoutMinutes: number = 30): Promise<ProcessingJob[]> {
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000)
    
    const jobs = await this.db
      .selectFrom('processing_jobs')
      .selectAll()
      .where('status', '=', ProcessingStatus.PROCESSING)
      .where('started_at', '<', timeoutDate)
      .orderBy('started_at', 'asc')
      .execute()

    return jobs.map(job => this.mapDatabaseJobToJob(job))
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    
    const result = await this.db
      .deleteFrom('processing_jobs')
      .where('status', 'in', [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED])
      .where('created_at', '<', cutoffDate)
      .executeTakeFirst()

    return Number(result?.numDeletedRows ?? 0)
  }

  /**
   * Map database job to ProcessingJob type
   */
  private mapDatabaseJobToJob(dbJob: any): ProcessingJob {
    const job: ProcessingJob = {
      id: dbJob.id,
      fileName: dbJob.file_name,
      filePath: dbJob.file_path,
      fileSize: dbJob.file_size,
      mimeType: dbJob.mime_type,
      processingType: dbJob.processing_type as ProcessingType,
      status: dbJob.status as ProcessingStatus,
      progress: dbJob.progress,
      createdAt: new Date(dbJob.created_at),
      updatedAt: new Date(dbJob.updated_at)
    }

    // Add optional fields
    if (dbJob.sample_id) job.sampleId = dbJob.sample_id
    if (dbJob.result) job.result = JSON.parse(dbJob.result)
    if (dbJob.error) job.error = dbJob.error
    if (dbJob.metadata) job.metadata = JSON.parse(dbJob.metadata)
    if (dbJob.started_at) job.startedAt = new Date(dbJob.started_at)
    if (dbJob.completed_at) job.completedAt = new Date(dbJob.completed_at)

    return job
  }
}