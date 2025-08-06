import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
import { X, Users, CheckSquare, AlertTriangle, Zap } from 'lucide-react'

const OPERATIONS = [
  { 
    value: 'update_status', 
    label: 'Update Status', 
    icon: CheckSquare,
    description: 'Change the processing status of selected samples'
  },
  { 
    value: 'update_priority', 
    label: 'Update Priority', 
    icon: AlertTriangle,
    description: 'Adjust priority level for processing order'
  },
  { 
    value: 'update_workflow_stage', 
    label: 'Update Workflow Stage', 
    icon: Zap,
    description: 'Advance samples through workflow stages'
  },
  { 
    value: 'assign_lab', 
    label: 'Assign Lab', 
    icon: Users,
    description: 'Reassign samples to different lab or personnel'
  },
  { 
    value: 'batch_process', 
    label: 'Batch Process', 
    icon: CheckSquare,
    description: 'Apply multiple changes simultaneously'
  }
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

interface Sample {
  id: string
  sample_name: string
  status: string
  priority: string
  workflow_stage?: string
  lab_name: string
  submitter_name: string
  submitter_email: string
}

interface BulkOperationsModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSamples: Sample[]
  onOperationCompleted: () => void
}

export default function BulkOperationsModal({ 
  isOpen, 
  onClose, 
  selectedSamples, 
  onOperationCompleted 
}: BulkOperationsModalProps) {
  const [selectedOperation, setSelectedOperation] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [workflowStage, setWorkflowStage] = useState('')
  const [labName, setLabName] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [batchNotes, setBatchNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedOperation('')
      setStatus('')
      setPriority('')
      setWorkflowStage('')
      setLabName('')
      setSubmitterName('')
      setSubmitterEmail('')
      setBatchNotes('')
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!selectedOperation) {
      setError('Please select an operation')
      return
    }

    setProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const operationData: Record<string, any> = {}

      // Build operation data based on selected operation
      switch (selectedOperation) {
        case 'update_status':
          if (!status) {
            setError('Please select a status')
            setProcessing(false)
            return
          }
          operationData.status = status
          break

        case 'update_priority':
          if (!priority) {
            setError('Please select a priority')
            setProcessing(false)
            return
          }
          operationData.priority = priority
          break

        case 'update_workflow_stage':
          if (!workflowStage) {
            setError('Please select a workflow stage')
            setProcessing(false)
            return
          }
          operationData.workflow_stage = workflowStage
          break

        case 'assign_lab':
          if (!labName) {
            setError('Please enter a lab name')
            setProcessing(false)
            return
          }
          operationData.lab_name = labName
          if (submitterName) operationData.submitter_name = submitterName
          if (submitterEmail) operationData.submitter_email = submitterEmail
          break

        case 'batch_process':
          if (status) operationData.status = status
          if (priority) operationData.priority = priority
          if (workflowStage) operationData.workflow_stage = workflowStage
          if (labName) operationData.lab_name = labName
          if (submitterName) operationData.submitter_name = submitterName
          if (submitterEmail) operationData.submitter_email = submitterEmail
          break
      }

      if (batchNotes) {
        operationData.batch_notes = batchNotes
      }

      const response = await fetch('/api/samples/bulk-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: selectedOperation,
          sample_ids: selectedSamples.map(s => s.id),
          data: operationData
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to perform bulk operation')
      }

      setSuccess(`Successfully updated ${selectedSamples.length} samples`)
      onOperationCompleted()
      
      // Close modal after short delay to show success message
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (error) {
      console.error('Error performing bulk operation:', error)
      setError(error instanceof Error ? error.message : 'Failed to perform bulk operation')
    } finally {
      setProcessing(false)
    }
  }

  const renderOperationFields = () => {
    switch (selectedOperation) {
      case 'update_status':
        return (
          <div>
            <Label className="text-sm font-medium text-gray-700">New Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select status...</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'update_priority':
        return (
          <div>
            <Label className="text-sm font-medium text-gray-700">New Priority</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select priority...</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'update_workflow_stage':
        return (
          <div>
            <Label className="text-sm font-medium text-gray-700">New Workflow Stage</Label>
            <select
              value={workflowStage}
              onChange={(e) => setWorkflowStage(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select workflow stage...</option>
              {WORKFLOW_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'assign_lab':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Lab Name *</Label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Enter lab name"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Submitter Name</Label>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="Enter submitter name (optional)"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Submitter Email</Label>
              <input
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="Enter submitter email (optional)"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )

      case 'batch_process':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Status (Optional)</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Keep current status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Priority (Optional)</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Keep current priority</option>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Workflow Stage (Optional)</Label>
              <select
                value={workflowStage}
                onChange={(e) => setWorkflowStage(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Keep current stage</option>
                {WORKFLOW_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Lab Name (Optional)</Label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Enter lab name (optional)"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bulk Operations</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedSamples.length} sample{selectedSamples.length !== 1 ? 's' : ''} selected
            </p>
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
          {/* Selected Samples Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Selected Samples</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedSamples.map((sample) => (
                <div key={sample.id} className="text-sm text-gray-600 flex items-center justify-between">
                  <span>{sample.sample_name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge className="text-xs">
                      {STATUS_OPTIONS.find(s => s.value === sample.status)?.label || sample.status}
                    </Badge>
                    <Badge className="text-xs">
                      {PRIORITY_OPTIONS.find(p => p.value === sample.priority)?.label || sample.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operation Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">Select Operation</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OPERATIONS.map((operation) => {
                const IconComponent = operation.icon
                return (
                  <div
                    key={operation.value}
                    onClick={() => setSelectedOperation(operation.value)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedOperation === operation.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <IconComponent className={`h-5 w-5 ${
                        selectedOperation === operation.value ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <div>
                        <div className={`font-medium ${
                          selectedOperation === operation.value ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {operation.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {operation.description}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Operation-Specific Fields */}
          {selectedOperation && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Operation Details</h3>
              <div className="space-y-4">
                {renderOperationFields()}
                
                {/* Batch Notes - Always available */}
                <div>
                  <Label className="text-sm font-medium text-gray-700">Notes (Optional)</Label>
                  <textarea
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="Add notes about this bulk operation..."
                    rows={3}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={processing || !selectedOperation}
          >
            {processing ? 'Processing...' : `Apply to ${selectedSamples.length} Sample${selectedSamples.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  )
}