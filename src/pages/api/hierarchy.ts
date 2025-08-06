import type { APIRoute } from 'astro'
import { db } from '../../lib/database'

// GET /api/hierarchy - Get complete hierarchical view of projects -> submissions -> samples
export const GET: APIRoute = async ({ url }) => {
  try {
    const project_id = url.searchParams.get('project_id')
    const submission_id = url.searchParams.get('submission_id')
    
    // Get hierarchical data using the view we created
    let query = db.selectFrom('sample_hierarchy').selectAll()
    
    if (project_id) {
      query = query.where('project_id', '=', project_id)
    }
    
    if (submission_id) {
      query = query.where('submission_id', '=', submission_id)
    }
    
    const flatResults = await query.execute()
    
    // Transform flat results into hierarchical structure
    const projectsMap = new Map()
    
    for (const row of flatResults) {
      // Get or create project
      if (!projectsMap.has(row.project_id)) {
        projectsMap.set(row.project_id, {
          id: row.project_id,
          name: row.project_name,
          status: row.project_status,
          submissions: new Map()
        })
      }
      
      const project = projectsMap.get(row.project_id)
      
      // Get or create submission under project
      if (!project.submissions.has(row.submission_id)) {
        project.submissions.set(row.submission_id, {
          id: row.submission_id,
          name: row.submission_name,
          status: row.submission_status,
          submission_type: row.submission_type,
          submitted_at: row.submitted_at,
          samples: []
        })
      }
      
      const submission = project.submissions.get(row.submission_id)
      
      // Add sample to submission (only if sample exists)
      if (row.sample_id) {
        submission.samples.push({
          id: row.sample_id,
          sample_name: row.sample_name,
          sample_id: row.sample_identifier,
          status: row.sample_status,
          priority: row.sample_priority,
          sample_type: row.sample_type,
          lab_name: row.lab_name,
          chart_field: row.chart_field,
          submitter_name: row.submitter_name,
          submitter_email: row.submitter_email,
          concentration: row.concentration,
          concentration_unit: row.concentration_unit,
          volume: row.volume,
          volume_unit: row.volume_unit,
          workflow_stage: row.workflow_stage,
          flow_cell_count: row.flow_cell_count,
          created_at: row.sample_created_at,
          updated_at: row.sample_updated_at
        })
      }
    }
    
    // Convert maps to arrays for JSON response
    const projects = Array.from(projectsMap.values()).map(project => ({
      ...project,
      submissions: Array.from(project.submissions.values())
    }))
    
    // Calculate summary statistics
    const totalProjects = projects.length
    const totalSubmissions = projects.reduce((sum, p) => sum + p.submissions.length, 0)
    const totalSamples = projects.reduce((sum: number, p: any) => 
      sum + p.submissions.reduce((subSum: number, s: any) => subSum + s.samples.filter((sample: any) => sample.id).length, 0), 0)
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        projects,
        summary: {
          totalProjects,
          totalSubmissions,
          totalSamples
        }
      },
      message: 'Hierarchy retrieved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get hierarchy error:', error)
    return new Response(JSON.stringify({
      success: false,
      data: { projects: [], summary: { totalProjects: 0, totalSubmissions: 0, totalSamples: 0 } },
      message: error instanceof Error ? error.message : 'Failed to retrieve hierarchy'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}