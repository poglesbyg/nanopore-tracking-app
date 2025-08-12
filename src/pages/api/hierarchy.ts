import type { APIRoute } from 'astro'
import { db } from '../../lib/database'

// GET /api/hierarchy - Get complete hierarchical view of projects -> submissions -> samples
export const GET: APIRoute = async ({ url }) => {
  try {
    const project_id = url.searchParams.get('project_id')
    const submission_id = url.searchParams.get('submission_id')
    
    // Build hierarchy directly from base tables (no dependency on database view)
    const flatResults: any[] = []
    const submissions = await db.selectFrom('nanopore_submissions').selectAll().execute().catch(() => [])
    const projects = await db.selectFrom('projects').selectAll().execute().catch(() => [])
    const projectMap = new Map(projects.map((p: any) => [p.id, p]))
    for (const sub of submissions) {
      if (submission_id && sub.id !== submission_id) continue
      if (project_id && sub.project_id !== project_id) continue
      const samples = await db
        .selectFrom('nanopore_samples')
        .selectAll()
        .where('submission_id', '=', sub.id)
        .execute()
        .catch(() => [])
      
      // If there are samples, add each one
      if (samples.length > 0) {
        for (const s of samples) {
          flatResults.push({
            project_id: (sub as any).project_id || null,
            project_name: (sub as any).project_id && projectMap.get((sub as any).project_id)?.name ? projectMap.get((sub as any).project_id).name : 'Default Project',
            project_status: 'active',
            submission_id: sub.id,
            submission_name: (sub as any).submission_number || (sub as any).name || 'Untitled Submission',
            submission_status: (sub as any).status,
            submission_type: (sub as any).submission_type || 'manual',
            submitted_at: (sub as any).submitted_at || (sub as any).submission_date,
            sample_id: s.id,
            sample_name: s.sample_name,
            sample_identifier: s.sample_id,
            sample_status: s.status,
            sample_priority: s.priority,
            sample_type: s.sample_type,
          lab_name: s.lab_name,
          chart_field: s.chart_field,
          submitter_name: s.submitter_name,
          submitter_email: s.submitter_email,
          concentration: s.concentration,
          concentration_unit: s.concentration_unit,
          volume: s.volume,
          volume_unit: s.volume_unit,
          qubit_concentration: (s as any).qubit_concentration ?? null,
          nanodrop_concentration: (s as any).nanodrop_concentration ?? null,
          a260_280_ratio: (s as any).a260_280_ratio ?? null,
          a260_230_ratio: (s as any).a260_230_ratio ?? null,
          workflow_stage: s.workflow_stage,
          flow_cell_count: s.flow_cell_count,
          sample_created_at: s.created_at,
          sample_updated_at: s.updated_at,
        })
      }
    } else {
      // No samples, but still add the submission
      flatResults.push({
        project_id: (sub as any).project_id || null,
        project_name: (sub as any).project_id && projectMap.get((sub as any).project_id)?.name ? projectMap.get((sub as any).project_id).name : 'Default Project',
        project_status: 'active',
        submission_id: sub.id,
        submission_name: (sub as any).submission_number || (sub as any).name || 'Untitled Submission',
        submission_status: (sub as any).status,
        submission_type: (sub as any).submission_type || 'manual',
        submitted_at: (sub as any).submitted_at || (sub as any).submission_date,
        sample_id: null,
        sample_name: null,
        sample_identifier: null,
        sample_status: null,
        sample_priority: null,
        sample_type: null,
        lab_name: null,
        chart_field: null,
        submitter_name: (sub as any).submitter_name,
        submitter_email: (sub as any).submitter_email,
        concentration: null,
        concentration_unit: null,
        volume: null,
        volume_unit: null,
        qubit_concentration: null,
        nanodrop_concentration: null,
        a260_280_ratio: null,
        a260_230_ratio: null,
        workflow_stage: null,
        flow_cell_count: null,
        sample_created_at: null,
        sample_updated_at: null,
      })
    }
    }
    
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
          qubit_concentration: row.qubit_concentration ?? null,
          nanodrop_concentration: row.nanodrop_concentration ?? null,
          a260_280_ratio: row.a260_280_ratio ?? null,
          a260_230_ratio: row.a260_230_ratio ?? null,
          workflow_stage: row.workflow_stage,
          flow_cell_count: row.flow_cell_count,
          created_at: row.sample_created_at,
          updated_at: row.sample_updated_at
        })
      }
    }
    
    // Convert maps to arrays for JSON response
    const projectsArr = Array.from(projectsMap.values()).map(project => ({
      ...project,
      submissions: Array.from(project.submissions.values())
    }))
    
    // Calculate summary statistics
    const totalProjects = projectsArr.length
    const totalSubmissions = projectsArr.reduce((sum, p) => sum + p.submissions.length, 0)
    const totalSamples = projectsArr.reduce((sum: number, p: any) => 
      sum + p.submissions.reduce((subSum: number, s: any) => subSum + s.samples.filter((sample: any) => sample.id).length, 0), 0)
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        projects: projectsArr,
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