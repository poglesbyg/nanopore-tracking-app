import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
import { X, Download, FileText, Database, CheckSquare, Calendar } from 'lucide-react'

const ENTITY_TYPES = [
  { 
    value: 'samples', 
    label: 'Samples', 
    icon: FileText,
    description: 'Export sample data with lab information and workflow stages'
  },
  { 
    value: 'submissions', 
    label: 'Submissions', 
    icon: Database,
    description: 'Export submission data with sample counts and metadata'
  },
  { 
    value: 'projects', 
    label: 'Projects', 
    icon: CheckSquare,
    description: 'Export project data with submission and sample counts'
  }
]

const FIELD_DEFINITIONS = {
  samples: [
    { key: 'id', label: 'Sample ID', category: 'Basic' },
    { key: 'sample_name', label: 'Sample Name', category: 'Basic' },
    { key: 'sample_id', label: 'Lab Sample ID', category: 'Basic' },
    { key: 'status', label: 'Status', category: 'Processing' },
    { key: 'priority', label: 'Priority', category: 'Processing' },
    { key: 'workflow_stage', label: 'Workflow Stage', category: 'Processing' },
    { key: 'sample_type', label: 'Sample Type', category: 'Laboratory' },
    { key: 'concentration', label: 'Concentration', category: 'Laboratory' },
    { key: 'concentration_unit', label: 'Concentration Unit', category: 'Laboratory' },
    { key: 'volume', label: 'Volume', category: 'Laboratory' },
    { key: 'volume_unit', label: 'Volume Unit', category: 'Laboratory' },
    { key: 'lab_name', label: 'Lab Name', category: 'Laboratory' },
    { key: 'chart_field', label: 'Chart Field', category: 'Administrative' },
    { key: 'submitter_name', label: 'Submitter Name', category: 'Administrative' },
    { key: 'submitter_email', label: 'Submitter Email', category: 'Administrative' },
    { key: 'created_at', label: 'Created Date', category: 'Timestamps' },
    { key: 'updated_at', label: 'Updated Date', category: 'Timestamps' },
    { key: 'submission_id', label: 'Submission ID', category: 'References' },
    { key: 'flow_cell_count', label: 'Flow Cell Count', category: 'Laboratory' }
  ],
  submissions: [
    { key: 'id', label: 'Submission ID', category: 'Basic' },
    { key: 'name', label: 'Submission Name', category: 'Basic' },
    { key: 'status', label: 'Status', category: 'Processing' },
    { key: 'submission_type', label: 'Type', category: 'Basic' },
    { key: 'description', label: 'Description', category: 'Basic' },
    { key: 'submitter_name', label: 'Submitter Name', category: 'Administrative' },
    { key: 'submitter_email', label: 'Submitter Email', category: 'Administrative' },
    { key: 'sample_count', label: 'Sample Count', category: 'Statistics' },
    { key: 'project_id', label: 'Project ID', category: 'References' },
    { key: 'created_at', label: 'Created Date', category: 'Timestamps' },
    { key: 'updated_at', label: 'Updated Date', category: 'Timestamps' },
    { key: 'submitted_at', label: 'Submitted Date', category: 'Timestamps' }
  ],
  projects: [
    { key: 'id', label: 'Project ID', category: 'Basic' },
    { key: 'name', label: 'Project Name', category: 'Basic' },
    { key: 'description', label: 'Description', category: 'Basic' },
    { key: 'status', label: 'Status', category: 'Processing' },
    { key: 'owner_name', label: 'Owner Name', category: 'Administrative' },
    { key: 'owner_email', label: 'Owner Email', category: 'Administrative' },
    { key: 'chart_prefix', label: 'Chart Prefix', category: 'Administrative' },
    { key: 'submission_count', label: 'Submission Count', category: 'Statistics' },
    { key: 'sample_count', label: 'Sample Count', category: 'Statistics' },
    { key: 'created_at', label: 'Created Date', category: 'Timestamps' },
    { key: 'updated_at', label: 'Updated Date', category: 'Timestamps' }
  ]
}

const STATUS_OPTIONS = ['submitted', 'prep', 'sequencing', 'analysis', 'completed', 'failed', 'archived']
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent']
const WORKFLOW_STAGES = ['sample_qc', 'library_prep', 'library_qc', 'sequencing_setup', 'sequencing_run', 'basecalling', 'quality_assessment', 'data_delivery']

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  availableProjects?: Array<{id: string, name: string}>
  availableSubmissions?: Array<{id: string, name: string}>
}

export default function ExportModal({ 
  isOpen, 
  onClose, 
  availableProjects = [], 
  availableSubmissions = [] 
}: ExportModalProps) {
  const [entityType, setEntityType] = useState('samples')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [selectAllFields, setSelectAllFields] = useState(true)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [workflowStageFilter, setWorkflowStageFilter] = useState<string[]>([])
  const [dateRangeStart, setDateRangeStart] = useState('')
  const [dateRangeEnd, setDateRangeEnd] = useState('')
  const [projectFilter, setProjectFilter] = useState<string[]>([])
  const [submissionFilter, setSubmissionFilter] = useState<string[]>([])
  
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens/closes or entity type changes
  useEffect(() => {
    if (isOpen) {
      const defaultFields = FIELD_DEFINITIONS[entityType as keyof typeof FIELD_DEFINITIONS]
        .filter(field => ['Basic', 'Processing', 'Laboratory'].includes(field.category))
        .map(field => field.key)
      
      setSelectedFields(defaultFields)
      setSelectAllFields(false)
      setStatusFilter([])
      setPriorityFilter([])
      setWorkflowStageFilter([])
      setDateRangeStart('')
      setDateRangeEnd('')
      setProjectFilter([])
      setSubmissionFilter([])
      setError(null)
    }
  }, [isOpen, entityType])

  if (!isOpen) return null

  const currentFields = FIELD_DEFINITIONS[entityType as keyof typeof FIELD_DEFINITIONS]
  const fieldsByCategory = currentFields.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = []
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, typeof currentFields>)

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(f => f !== fieldKey)
        : [...prev, fieldKey]
    )
    setSelectAllFields(false)
  }

  const handleSelectAllFields = () => {
    if (selectAllFields) {
      setSelectedFields([])
    } else {
      setSelectedFields(currentFields.map(f => f.key))
    }
    setSelectAllFields(!selectAllFields)
  }

  const handleExport = async () => {
    if (!selectAllFields && selectedFields.length === 0) {
      setError('Please select at least one field to export')
      return
    }

    setExporting(true)
    setError(null)

    try {
      const exportConfig = {
        format,
        fields: selectAllFields ? undefined : selectedFields,
        filters: {
          ...(statusFilter.length > 0 && { status: statusFilter }),
          ...(priorityFilter.length > 0 && { priority: priorityFilter }),
          ...(workflowStageFilter.length > 0 && { workflow_stage: workflowStageFilter }),
          ...(dateRangeStart || dateRangeEnd) && {
            date_range: {
              ...(dateRangeStart && { start: dateRangeStart }),
              ...(dateRangeEnd && { end: dateRangeEnd })
            }
          },
          ...(projectFilter.length > 0 && { project_ids: projectFilter }),
          ...(submissionFilter.length > 0 && { submission_ids: submissionFilter })
        }
      }

      const response = await fetch(`/api/export/${entityType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportConfig),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Export failed' }))
        throw new Error(errorData.message || `Export failed: ${response.statusText}`)
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `${entityType}_export.${format}`

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      onClose()

    } catch (error) {
      console.error('Error exporting data:', error)
      setError(error instanceof Error ? error.message : 'Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" data-testid="export-modal">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Export Data</h2>
            <p className="text-sm text-gray-500 mt-1">Configure and download your data export</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Entity Type Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">What would you like to export?</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ENTITY_TYPES.map((type) => {
                const IconComponent = type.icon
                return (
                  <div
                    key={type.value}
                    onClick={() => setEntityType(type.value)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      entityType === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className={`h-5 w-5 ${
                        entityType === type.value ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div>
                        <div className={`font-medium ${
                          entityType === type.value ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {type.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {type.description}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">Export Format</Label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">CSV (Comma Separated Values)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">JSON (JavaScript Object Notation)</span>
              </label>
            </div>
          </div>

          {/* Field Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium text-gray-700">Fields to Export</Label>
              <button
                onClick={handleSelectAllFields}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectAllFields ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">{category}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {fields.map((field) => (
                      <label key={field.key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectAllFields || selectedFields.includes(field.key)}
                          onChange={() => handleFieldToggle(field.key)}
                          disabled={selectAllFields}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filters (Optional)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Filter */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Status</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {STATUS_OPTIONS.map((status) => (
                    <label key={status} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStatusFilter([...statusFilter, status])
                          } else {
                            setStatusFilter(statusFilter.filter(s => s !== status))
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter (for samples) */}
              {entityType === 'samples' && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Priority</Label>
                  <div className="space-y-1">
                    {PRIORITY_OPTIONS.map((priority) => (
                      <label key={priority} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={priorityFilter.includes(priority)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPriorityFilter([...priorityFilter, priority])
                            } else {
                              setPriorityFilter(priorityFilter.filter(p => p !== priority))
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700 capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Workflow Stage Filter (for samples) */}
              {entityType === 'samples' && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Workflow Stage</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {WORKFLOW_STAGES.map((stage) => (
                      <label key={stage} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={workflowStageFilter.includes(stage)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWorkflowStageFilter([...workflowStageFilter, stage])
                            } else {
                              setWorkflowStageFilter(workflowStageFilter.filter(s => s !== stage))
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{stage.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Range Filter */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Date Range
                </Label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">Start Date</label>
                    <input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End Date</label>
                    <input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Project Filter */}
              {availableProjects.length > 0 && (entityType === 'submissions' || entityType === 'samples') && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Projects</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {availableProjects.map((project) => (
                      <label key={project.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={projectFilter.includes(project.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setProjectFilter([...projectFilter, project.id])
                            } else {
                              setProjectFilter(projectFilter.filter(p => p !== project.id))
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{project.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {selectAllFields ? 'All fields' : `${selectedFields.length} fields`} selected
            {statusFilter.length + priorityFilter.length + workflowStageFilter.length + projectFilter.length + submissionFilter.length > 0 && 
              ` • ${statusFilter.length + priorityFilter.length + workflowStageFilter.length + projectFilter.length + submissionFilter.length} filters applied`
            }
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport}
              disabled={exporting || (!selectAllFields && selectedFields.length === 0)}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}