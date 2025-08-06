import { useState, useEffect } from 'react'
import CreateProjectModal from './create-project-modal'
import SampleDetailModal from './sample-detail-modal'
import BulkOperationsModal from './bulk-operations-modal'
import ExportModal from './export-modal'

interface Sample {
  id: string
  sample_name: string
  sample_id: string
  status: string
  priority: string
  sample_type: string
  lab_name: string
  chart_field: string
  submitter_name: string
  submitter_email: string
  concentration?: string
  concentration_unit?: string
  volume?: string
  volume_unit?: string
  workflow_stage?: string
  created_at: string
  updated_at: string
}

interface Submission {
  id: string
  name: string
  status: string
  submission_type: string
  submitted_at: string
  samples: Sample[]
}

interface Project {
  id: string
  name: string
  status: string
  submissions: Submission[]
}

interface HierarchyData {
  projects: Project[]
  summary: {
    totalProjects: number
    totalSubmissions: number
    totalSamples: number
  }
}

export default function HierarchicalDashboard() {
  const [hierarchyData, setHierarchyData] = useState<HierarchyData>({
    projects: [],
    summary: { totalProjects: 0, totalSubmissions: 0, totalSamples: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set())
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null)
  const [showSampleModal, setShowSampleModal] = useState(false)
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set())
  const [showBulkOperationsModal, setShowBulkOperationsModal] = useState(false)
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  useEffect(() => {
    fetchHierarchyData()
  }, [])

  const fetchHierarchyData = async () => {
    try {
      const response = await fetch('/api/hierarchy')
      const data = await response.json()

      if (data && data.success && data.data) {
        setHierarchyData(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch hierarchy data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  const toggleSubmission = (submissionId: string) => {
    const newExpanded = new Set(expandedSubmissions)
    if (newExpanded.has(submissionId)) {
      newExpanded.delete(submissionId)
    } else {
      newExpanded.add(submissionId)
    }
    setExpandedSubmissions(newExpanded)
  }

  const handleSampleClick = (sample: Sample, event?: React.MouseEvent) => {
    // If in bulk selection mode and clicking checkbox area, handle selection
    if (bulkSelectionMode && event?.target && (event.target as HTMLInputElement).type === 'checkbox') {
      return // Let the checkbox handler manage this
    }
    
    // If in bulk selection mode but not clicking checkbox, toggle selection
    if (bulkSelectionMode) {
      toggleSampleSelection(sample.id)
      return
    }

    // Normal mode - open sample detail modal
    setSelectedSample(sample)
    setShowSampleModal(true)
  }

  const handleSampleUpdated = () => {
    fetchHierarchyData() // Refresh the hierarchy data
  }

  const toggleSampleSelection = (sampleId: string) => {
    const newSelection = new Set(selectedSamples)
    if (newSelection.has(sampleId)) {
      newSelection.delete(sampleId)
    } else {
      newSelection.add(sampleId)
    }
    setSelectedSamples(newSelection)
  }

  const toggleBulkSelectionMode = () => {
    setBulkSelectionMode(!bulkSelectionMode)
    if (bulkSelectionMode) {
      setSelectedSamples(new Set()) // Clear selections when exiting bulk mode
    }
  }

  const selectAllVisibleSamples = () => {
    const allSampleIds = new Set<string>()
    hierarchyData.projects.forEach(project => {
      if (expandedProjects.has(project.id)) {
        project.submissions.forEach(submission => {
          if (expandedSubmissions.has(submission.id)) {
            submission.samples.forEach(sample => {
              allSampleIds.add(sample.id)
            })
          }
        })
      }
    })
    setSelectedSamples(allSampleIds)
  }

  const clearAllSelections = () => {
    setSelectedSamples(new Set())
  }

  const handleBulkOperationsCompleted = () => {
    fetchHierarchyData() // Refresh the hierarchy data
    setSelectedSamples(new Set()) // Clear selections
    setShowBulkOperationsModal(false)
  }

  const getSelectedSampleObjects = (): Sample[] => {
    const selectedSampleObjects: Sample[] = []
    hierarchyData.projects.forEach(project => {
      project.submissions.forEach(submission => {
        submission.samples.forEach(sample => {
          if (selectedSamples.has(sample.id)) {
            selectedSampleObjects.push(sample)
          }
        })
      })
    })
    return selectedSampleObjects
  }

  const getAvailableProjects = () => {
    return hierarchyData.projects.map(project => ({
      id: project.id,
      name: project.name
    }))
  }

  const getAvailableSubmissions = () => {
    const submissions: Array<{id: string, name: string}> = []
    hierarchyData.projects.forEach(project => {
      project.submissions.forEach(submission => {
        submissions.push({
          id: submission.id,
          name: submission.name
        })
      })
    })
    return submissions
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading hierarchy...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>
          Nanopore Sample Hierarchy
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>
          Manage projects, submissions, and samples in a hierarchical structure
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Projects</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>
            {hierarchyData.summary.totalProjects}
          </p>
        </div>
        
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Submissions</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
            {hierarchyData.summary.totalSubmissions}
          </p>
        </div>
        
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Samples</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>
            {hierarchyData.summary.totalSamples}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600' }}>Quick Actions</h2>
          {bulkSelectionMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#6b7280' }}>
              <span>{selectedSamples.size} selected</span>
              <button
                onClick={selectAllVisibleSamples}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Select All Visible
              </button>
              <button
                onClick={clearAllSelections}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowCreateProjectModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              display: 'inline-block',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            + New Project
          </button>
          <a
            href="/submissions"
            style={{
              padding: '12px 24px',
              backgroundColor: '#10b981',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              display: 'inline-block'
            }}
          >
            + New Submission
          </a>
          <button
            onClick={toggleBulkSelectionMode}
            style={{
              padding: '12px 24px',
              backgroundColor: bulkSelectionMode ? '#dc2626' : '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {bulkSelectionMode ? 'Exit Bulk Mode' : 'Bulk Operations'}
          </button>
          {bulkSelectionMode && selectedSamples.size > 0 && (
            <button
              onClick={() => setShowBulkOperationsModal(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Apply Operations ({selectedSamples.size})
            </button>
          )}
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            📊 Export Data
          </button>
        </div>
      </div>

      {/* Hierarchical View */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Project Hierarchy</h2>
        </div>
        
        {hierarchyData.projects.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>No projects yet</p>
            <p>Create your first project to get started</p>
            <button
              onClick={() => setShowCreateProjectModal(true)}
              style={{
                display: 'inline-block',
                marginTop: '15px',
                padding: '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Create Project
            </button>
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            {hierarchyData.projects.map((project) => (
              <div key={project.id} style={{ marginBottom: '20px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                {/* Project Header */}
                <div 
                  style={{ 
                    padding: '15px', 
                    backgroundColor: '#f8fafc', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => toggleProject(project.id)}
                >
                  <div>
                    <span style={{ fontSize: '18px', fontWeight: '600' }}>📁 {project.name}</span>
                    <span style={{ 
                      marginLeft: '10px', 
                      padding: '2px 8px', 
                      backgroundColor: project.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: project.status === 'active' ? '#166534' : '#991b1b',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {project.status}
                    </span>
                    <span style={{ marginLeft: '15px', color: '#6b7280', fontSize: '14px' }}>
                      {project.submissions.length} submission{project.submissions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    {expandedProjects.has(project.id) ? '▼' : '▶'}
                  </span>
                </div>

                {/* Submissions under Project */}
                {expandedProjects.has(project.id) && (
                  <div style={{ padding: '0 15px 15px 15px' }}>
                    {project.submissions.map((submission) => (
                      <div key={submission.id} style={{ 
                        marginLeft: '20px', 
                        marginBottom: '15px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px'
                      }}>
                        {/* Submission Header */}
                        <div 
                          style={{ 
                            padding: '12px', 
                            backgroundColor: '#f9fafb',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onClick={() => toggleSubmission(submission.id)}
                        >
                          <div>
                            <span style={{ fontSize: '16px', fontWeight: '500' }}>📄 {submission.name}</span>
                            <span style={{ 
                              marginLeft: '10px', 
                              padding: '2px 6px', 
                              backgroundColor: '#e0e7ff',
                              color: '#3730a3',
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              {submission.status}
                            </span>
                            <span style={{ marginLeft: '10px', color: '#6b7280', fontSize: '13px' }}>
                              {submission.samples.length} sample{submission.samples.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            {expandedSubmissions.has(submission.id) ? '▼' : '▶'}
                          </span>
                        </div>

                        {/* Samples under Submission */}
                        {expandedSubmissions.has(submission.id) && (
                          <div style={{ padding: '12px' }}>
                            {submission.samples.length === 0 ? (
                              <p style={{ color: '#6b7280', fontSize: '14px', marginLeft: '20px' }}>
                                No samples in this submission
                              </p>
                            ) : (
                              submission.samples.map((sample) => (
                                <div 
                                  key={sample.id} 
                                  onClick={(e) => handleSampleClick(sample, e)}
                                  style={{ 
                                    marginLeft: '20px',
                                    padding: '8px 12px',
                                    backgroundColor: bulkSelectionMode && selectedSamples.has(sample.id) ? '#eff6ff' : '#ffffff',
                                    border: bulkSelectionMode && selectedSamples.has(sample.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                    borderRadius: '3px',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!bulkSelectionMode || !selectedSamples.has(sample.id)) {
                                      e.currentTarget.style.backgroundColor = '#f3f4f6'
                                      e.currentTarget.style.borderColor = '#d1d5db'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (bulkSelectionMode && selectedSamples.has(sample.id)) {
                                      e.currentTarget.style.backgroundColor = '#eff6ff'
                                      e.currentTarget.style.borderColor = '#3b82f6'
                                    } else {
                                      e.currentTarget.style.backgroundColor = '#ffffff'
                                      e.currentTarget.style.borderColor = '#e5e7eb'
                                    }
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {bulkSelectionMode && (
                                      <input
                                        type="checkbox"
                                        checked={selectedSamples.has(sample.id)}
                                        onChange={() => toggleSampleSelection(sample.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ 
                                          marginRight: '10px',
                                          width: '16px',
                                          height: '16px',
                                          cursor: 'pointer'
                                        }}
                                      />
                                    )}
                                    <div>
                                      <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                        🧬 {sample.sample_name}
                                      </span>
                                      <span style={{ marginLeft: '10px', color: '#6b7280', fontSize: '12px' }}>
                                        {sample.sample_type} • {sample.chart_field}
                                      </span>
                                      {sample.workflow_stage && (
                                        <span style={{ 
                                          marginLeft: '10px', 
                                          padding: '1px 4px',
                                          backgroundColor: '#e0f2fe',
                                          color: '#0369a1',
                                          borderRadius: '2px',
                                          fontSize: '10px',
                                          fontWeight: '500'
                                        }}>
                                          {sample.workflow_stage.replace('_', ' ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ 
                                      padding: '2px 6px', 
                                      backgroundColor: sample.status === 'submitted' ? '#fef3c7' : '#fee2e2',
                                      color: sample.status === 'submitted' ? '#92400e' : '#991b1b',
                                      borderRadius: '3px',
                                      fontSize: '11px',
                                      fontWeight: '500'
                                    }}>
                                      {sample.status}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                      →
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onProjectCreated={() => {
          setShowCreateProjectModal(false)
          fetchHierarchyData() // Refresh the hierarchy data
        }}
      />

      <SampleDetailModal
        isOpen={showSampleModal}
        onClose={() => setShowSampleModal(false)}
        sample={selectedSample}
        onSampleUpdated={handleSampleUpdated}
      />

      <BulkOperationsModal
        isOpen={showBulkOperationsModal}
        onClose={() => setShowBulkOperationsModal(false)}
        selectedSamples={getSelectedSampleObjects()}
        onOperationCompleted={handleBulkOperationsCompleted}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        availableProjects={getAvailableProjects()}
        availableSubmissions={getAvailableSubmissions()}
      />
    </div>
  )
}