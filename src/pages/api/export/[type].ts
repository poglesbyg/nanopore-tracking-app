import type { APIRoute } from 'astro'
import { db } from '../../../lib/database'
import { badRequest, internalError } from '../../../lib/api/server-response'
import { z } from 'zod'

// Export configuration schema
const exportConfigSchema = z.object({
  format: z.enum(['csv', 'json']),
  fields: z.array(z.string()).optional(), // If not provided, export all fields
  filters: z.object({
    status: z.array(z.string()).optional(),
    priority: z.array(z.string()).optional(),
    workflow_stage: z.array(z.string()).optional(),
    date_range: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    project_ids: z.array(z.string()).optional(),
    submission_ids: z.array(z.string()).optional()
  }).optional()
})

// Field mappings for each entity type
const FIELD_MAPPINGS = {
  samples: {
    id: 'Sample ID',
    sample_name: 'Sample Name',
    sample_id: 'Lab Sample ID',
    status: 'Status',
    priority: 'Priority',
    sample_type: 'Sample Type',
    lab_name: 'Lab Name',
    chart_field: 'Chart Field',
    submitter_name: 'Submitter Name',
    submitter_email: 'Submitter Email',
    concentration: 'Concentration',
    concentration_unit: 'Concentration Unit',
    volume: 'Volume',
    volume_unit: 'Volume Unit',
    workflow_stage: 'Workflow Stage',
    created_at: 'Created Date',
    updated_at: 'Updated Date',
    submission_id: 'Submission ID',
    flow_cell_count: 'Flow Cell Count'
  },
  submissions: {
    id: 'Submission ID',
    project_id: 'Project ID',
    name: 'Submission Name',
    status: 'Status',
    submission_type: 'Type',
    description: 'Description',
    submitter_name: 'Submitter Name',
    submitter_email: 'Submitter Email',
    created_at: 'Created Date',
    updated_at: 'Updated Date',
    submitted_at: 'Submitted Date',
    sample_count: 'Sample Count'
  },
  projects: {
    id: 'Project ID',
    name: 'Project Name',
    description: 'Description',
    owner_name: 'Owner Name',
    owner_email: 'Owner Email',
    status: 'Status',
    chart_prefix: 'Chart Prefix',
    created_at: 'Created Date',
    updated_at: 'Updated Date',
    submission_count: 'Submission Count',
    sample_count: 'Sample Count'
  }
}

// Convert data to CSV format
function convertToCSV(data: any[], fieldMapping: Record<string, string>, selectedFields?: string[]): string {
  if (data.length === 0) return ''

  const fields = selectedFields || Object.keys(fieldMapping)
  const headers = fields.map(field => fieldMapping[field] || field)
  
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      fields.map(field => {
        const value = row[field]
        if (value === null || value === undefined) return ''
        
        // Escape CSV values that contain commas, quotes, or newlines
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ]
  
  return csvRows.join('\n')
}

// Apply filters to query builder
function applyFilters(query: any, filters: any, entityType: string) {
  if (!filters) return query

  // Status filter
  if (filters.status && filters.status.length > 0) {
    query = query.where('status', 'in', filters.status)
  }

  // Priority filter (for samples)
  if (entityType === 'samples' && filters.priority && filters.priority.length > 0) {
    query = query.where('priority', 'in', filters.priority)
  }

  // Workflow stage filter (for samples)
  if (entityType === 'samples' && filters.workflow_stage && filters.workflow_stage.length > 0) {
    query = query.where('workflow_stage', 'in', filters.workflow_stage)
  }

  // Date range filter
  if (filters.date_range) {
    if (filters.date_range.start) {
      query = query.where('created_at', '>=', filters.date_range.start)
    }
    if (filters.date_range.end) {
      query = query.where('created_at', '<=', filters.date_range.end)
    }
  }

  // Project filter (for submissions and samples)
  if (filters.project_ids && filters.project_ids.length > 0) {
    if (entityType === 'submissions') {
      query = query.where('project_id', 'in', filters.project_ids)
    } else if (entityType === 'samples') {
      query = query.innerJoin('submissions', 'nanopore_samples.submission_id', 'submissions.id')
                   .where('submissions.project_id', 'in', filters.project_ids)
    }
  }

  // Submission filter (for samples)
  if (entityType === 'samples' && filters.submission_ids && filters.submission_ids.length > 0) {
    query = query.where('submission_id', 'in', filters.submission_ids)
  }

  return query
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const entityType = params.type
    if (!entityType || !['samples', 'submissions', 'projects'].includes(entityType)) {
      return badRequest('Invalid entity type. Must be one of: samples, submissions, projects')
    }

    const body = await request.json()
    const validationResult = exportConfigSchema.safeParse(body)
    
    if (!validationResult.success) {
      return badRequest('Invalid export configuration', validationResult.error.errors.map(e => e.message))
    }

    const { format, fields, filters } = validationResult.data
    const fieldMapping = FIELD_MAPPINGS[entityType as keyof typeof FIELD_MAPPINGS]

    let query
    let data: any[] = []

    // Build queries based on entity type
    switch (entityType) {
      case 'samples':
        query = db.selectFrom('nanopore_samples').selectAll()
        query = applyFilters(query, filters, 'samples')
        data = await query.execute()
        break

      case 'submissions':
        // Get submissions with sample count using LEFT JOIN
        const submissionsWithCounts = await db
          .selectFrom('submissions')
          .leftJoin('nanopore_samples', 'submissions.id', 'nanopore_samples.submission_id')
          .select([
            'submissions.id',
            'submissions.project_id', 
            'submissions.name',
            'submissions.status',
            'submissions.submission_type',
            'submissions.description',
            'submissions.submitter_name',
            'submissions.submitter_email',
            'submissions.created_at',
            'submissions.updated_at',
            'submissions.submitted_at',
            db.fn.count('nanopore_samples.id').as('sample_count')
          ])
          .groupBy([
            'submissions.id',
            'submissions.project_id',
            'submissions.name', 
            'submissions.status',
            'submissions.submission_type',
            'submissions.description',
            'submissions.submitter_name',
            'submissions.submitter_email',
            'submissions.created_at',
            'submissions.updated_at',
            'submissions.submitted_at'
          ])
        
        query = submissionsWithCounts
        query = applyFilters(query, filters, 'submissions')
        data = await query.execute()
        break

      case 'projects':
        // Get projects with submission and sample counts
        // Get projects with submission and sample counts using LEFT JOINs
        const projectsWithCounts = await db
          .selectFrom('projects')
          .leftJoin('submissions', 'projects.id', 'submissions.project_id')
          .leftJoin('nanopore_samples', 'submissions.id', 'nanopore_samples.submission_id')
          .select([
            'projects.id',
            'projects.name',
            'projects.description',
            'projects.owner_name',
            'projects.owner_email',
            'projects.status',
            'projects.chart_prefix',
            'projects.created_at',
            'projects.updated_at',
            db.fn.count('submissions.id').as('submission_count'),
            db.fn.count('nanopore_samples.id').as('sample_count')
          ])
          .groupBy([
            'projects.id',
            'projects.name',
            'projects.description',
            'projects.owner_name',
            'projects.owner_email',
            'projects.status',
            'projects.chart_prefix',
            'projects.created_at',
            'projects.updated_at'
          ])
        
        query = projectsWithCounts
        
        query = applyFilters(query, filters, 'projects')
        data = await query.execute()
        break
    }

    // Format the data based on requested format
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    let responseData: string
    let contentType: string
    let filename: string

    if (format === 'csv') {
      responseData = convertToCSV(data, fieldMapping, fields)
      contentType = 'text/csv'
      filename = `${entityType}_export_${timestamp}.csv`
    } else {
      // JSON format
      const jsonData = {
        export_info: {
          entity_type: entityType,
          format: format,
          timestamp: new Date().toISOString(),
          total_records: data.length,
          fields_included: fields || Object.keys(fieldMapping),
          filters_applied: filters || {}
        },
        data: data
      }
      responseData = JSON.stringify(jsonData, null, 2)
      contentType = 'application/json'
      filename = `${entityType}_export_${timestamp}.json`
    }

    // Return the file as a download
    return new Response(responseData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error exporting data:', error)
    return internalError('Failed to export data')
  }
}