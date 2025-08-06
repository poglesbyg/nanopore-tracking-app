import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
// Simple select component replacement (removed complex Radix dependency)
import { X, Calendar, User, TestTube, Beaker } from 'lucide-react'

// Import workflow stages from our processing steps (must match backend enum values)
const WORKFLOW_STAGES = [
  { value: 'sample_qc', label: 'Sample QC', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'library_prep', label: 'Library Prep', color: 'bg-blue-100 text-blue-800' },
  { value: 'library_qc', label: 'Library QC', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'sequencing_setup', label: 'Sequencing Setup', color: 'bg-purple-100 text-purple-800' },
  { value: 'sequencing_run', label: 'Sequencing Run', color: 'bg-pink-100 text-pink-800' },
  { value: 'basecalling', label: 'Basecalling', color: 'bg-green-100 text-green-800' },
  { value: 'quality_assessment', label: 'Quality Assessment', color: 'bg-teal-100 text-teal-800' },
  { value: 'data_delivery', label: 'Data Delivery', color: 'bg-emerald-100 text-emerald-800' }
]

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted', color: 'bg-gray-100 text-gray-800' },
  { value: 'prep', label: 'In Preparation', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'sequencing', label: 'Sequencing', color: 'bg-blue-100 text-blue-800' },
  { value: 'analysis', label: 'Analysis', color: 'bg-purple-100 text-purple-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-800' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
]

const SAMPLE_TYPE_OPTIONS = [
  { value: 'DNA', label: 'DNA' },
  { value: 'RNA', label: 'RNA' },
  { value: 'Protein', label: 'Protein' },
  { value: 'Other', label: 'Other' }
]

const CONCENTRATION_UNITS = ['ng/μL', 'ng/ml', 'μg/ml', 'mg/ml']
const VOLUME_UNITS = ['μL', 'ml', 'L']

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

interface SampleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sample: Sample | null
  onSampleUpdated: () => void
}

export default function SampleDetailModal({ isOpen, onClose, sample, onSampleUpdated }: SampleDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [workflowStage, setWorkflowStage] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [sampleName, setSampleName] = useState('')
  const [sampleType, setSampleType] = useState('')
  const [concentration, setConcentration] = useState('')
  const [concentrationUnit, setConcentrationUnit] = useState('')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] = useState('')
  const [labName, setLabName] = useState('')
  const [chartField, setChartField] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sample) {
      setWorkflowStage(sample.workflow_stage || 'sample_qc')
      setStatus(sample.status)
      setPriority(sample.priority)
      setSampleName(sample.sample_name)
      setSampleType(sample.sample_type)
      setConcentration(sample.concentration || '')
      setConcentrationUnit(sample.concentration_unit || '')
      setVolume(sample.volume || '')
      setVolumeUnit(sample.volume_unit || '')
      setLabName(sample.lab_name)
      setChartField(sample.chart_field)
      setSubmitterName(sample.submitter_name)
      setSubmitterEmail(sample.submitter_email)
      setError(null)
      setIsEditing(false)
    }
  }, [sample])

  if (!isOpen || !sample) return null

  const handleSave = async () => {
    setUpdating(true)
    setError(null)
    
    try {
      // Update all sample properties
      const updateData = {
        sample_name: sampleName,
        sample_type: sampleType,
        concentration: concentration || undefined,
        concentration_unit: concentrationUnit || undefined,
        volume: volume || undefined,
        volume_unit: volumeUnit || undefined,
        priority: priority,
        status: status,
        lab_name: labName,
        chart_field: chartField,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
      }

      const response = await fetch(`/api/samples/${sample.id}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update sample')
      }

      // Update workflow stage separately if changed
      if (workflowStage !== sample.workflow_stage) {
        const stageResponse = await fetch(`/api/samples/${sample.id}/stage`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ target_stage: workflowStage }),
        })

        const stageResult = await stageResponse.json()

        if (!stageResponse.ok || !stageResult.success) {
          throw new Error(stageResult.message || 'Failed to update workflow stage')
        }
      }

      onSampleUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating sample:', error)
      setError(error instanceof Error ? error.message : 'Failed to update sample')
    } finally {
      setUpdating(false)
    }
  }

  const handleCancel = () => {
    // Reset all fields to original values
    if (sample) {
      setWorkflowStage(sample.workflow_stage || 'sample_qc')
      setStatus(sample.status)
      setPriority(sample.priority)
      setSampleName(sample.sample_name)
      setSampleType(sample.sample_type)
      setConcentration(sample.concentration || '')
      setConcentrationUnit(sample.concentration_unit || '')
      setVolume(sample.volume || '')
      setVolumeUnit(sample.volume_unit || '')
      setLabName(sample.lab_name)
      setChartField(sample.chart_field)
      setSubmitterName(sample.submitter_name)
      setSubmitterEmail(sample.submitter_email)
    }
    setIsEditing(false)
    setError(null)
  }

  const getCurrentStageInfo = () => {
    return WORKFLOW_STAGES.find(stage => stage.value === workflowStage) || WORKFLOW_STAGES[0]
  }

  const getCurrentStatusInfo = () => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  }

  const getCurrentPriorityInfo = () => {
    return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1]
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Sample' : 'Sample Details'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{sample.sample_id}</p>
          </div>
          <div className="flex items-center space-x-2">
            {!isEditing && (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-sm"
              >
                Edit
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Sample Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Sample Name</Label>
                {isEditing ? (
                  <input
                    type="text"
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900">{sample.sample_name}</p>
                )}
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Sample Type</Label>
                {isEditing ? (
                  <select
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {SAMPLE_TYPE_OPTIONS.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 flex items-center space-x-2">
                    <TestTube className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{sample.sample_type}</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Chart Field</Label>
                {isEditing ? (
                  <input
                    type="text"
                    value={chartField}
                    onChange={(e) => setChartField(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-900">{sample.chart_field}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Lab</Label>
                {isEditing ? (
                  <input
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <div className="mt-1 flex items-center space-x-2">
                    <Beaker className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{sample.lab_name || 'Not specified'}</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Concentration</Label>
                {isEditing ? (
                  <div className="mt-1 flex space-x-2">
                    <input
                      type="text"
                      value={concentration}
                      onChange={(e) => setConcentration(e.target.value)}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={concentrationUnit}
                      onChange={(e) => setConcentrationUnit(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unit</option>
                      {CONCENTRATION_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">
                    {sample.concentration ? `${sample.concentration} ${sample.concentration_unit}` : 'Not specified'}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Volume</Label>
                {isEditing ? (
                  <div className="mt-1 flex space-x-2">
                    <input
                      type="text"
                      value={volume}
                      onChange={(e) => setVolume(e.target.value)}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={volumeUnit}
                      onChange={(e) => setVolumeUnit(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unit</option>
                      {VOLUME_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">
                    {sample.volume ? `${sample.volume} ${sample.volume_unit}` : 'Not specified'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Submitter Name</Label>
                {isEditing ? (
                  <input
                    type="text"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <div className="mt-1 flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{sample.submitter_name}</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Submitter Email</Label>
                {isEditing ? (
                  <input
                    type="email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="mt-1 text-xs text-gray-500">{sample.submitter_email}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Priority</Label>
                {isEditing ? (
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-2">
                    <Badge className={getCurrentPriorityInfo()?.color || 'bg-gray-100 text-gray-800'}>
                      {getCurrentPriorityInfo()?.label || 'Unknown'}
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                {isEditing ? (
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-2">
                    <Badge className={getCurrentStatusInfo()?.color || 'bg-gray-100 text-gray-800'}>
                      {getCurrentStatusInfo()?.label || 'Unknown'}
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Workflow Stage</Label>
                {isEditing ? (
                  <select
                    value={workflowStage}
                    onChange={(e) => setWorkflowStage(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {WORKFLOW_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-2">
                    <Badge className={getCurrentStageInfo()?.color || 'bg-gray-100 text-gray-800'}>
                      {getCurrentStageInfo()?.label || 'Unknown'}
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Created</Label>
                <div className="mt-1 flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {new Date(sample.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={updating}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updating}
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}