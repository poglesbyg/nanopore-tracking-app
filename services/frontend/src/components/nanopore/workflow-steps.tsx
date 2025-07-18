'use client'

import React, { useState } from 'react'
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Play, 
  Pause, 
  AlertCircle, 
  User, 
  Calendar,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Save,
  X
} from 'lucide-react'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Progress } from '../ui/progress'
import { Input } from '../ui/input'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '../ui/dialog'
import { toast } from 'sonner'

// Context added by Giga nanopore-workflow-model

interface ProcessingStep {
  id: string
  sampleId: string
  stepName: string
  stepStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  assignedTo?: string
  startedAt?: string
  completedAt?: string
  estimatedDurationHours?: number
  notes?: string
  resultsData?: any
  createdAt: string
  updatedAt: string
}

interface WorkflowStepsProps {
  sampleId: string
  steps: ProcessingStep[]
  onStepUpdate: (stepId: string, updates: Partial<ProcessingStep>) => Promise<void>
  onStepComplete: (stepId: string, notes?: string, resultsData?: any) => Promise<void>
  onStepStart: (stepId: string, assignedTo?: string) => Promise<void>
  readonly?: boolean
}

interface StepEditModalProps {
  step: ProcessingStep | null
  isOpen: boolean
  onClose: () => void
  onSave: (updates: Partial<ProcessingStep>) => Promise<void>
}

const STEP_ICONS = {
  'Sample QC': '🧪',
  'Library Preparation': '🔬',
  'Library QC': '📊',
  'Sequencing Setup': '⚙️',
  'Sequencing Run': '🧬',
  'Basecalling': '💻',
  'Quality Assessment': '📈',
  'Data Delivery': '📤'
}

const TEAM_MEMBERS = [
  'Grey',
  'Stephanie', 
  'Jenny',
  'Alex',
  'Morgan',
  'Unassigned'
]

function getStatusColor(status: ProcessingStep['stepStatus']): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'skipped':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getStatusIcon(status: ProcessingStep['stepStatus']) {
  switch (status) {
    case 'pending':
      return <Circle className="h-4 w-4" />
    case 'in_progress':
      return <Play className="h-4 w-4" />
    case 'completed':
      return <CheckCircle className="h-4 w-4" />
    case 'failed':
      return <AlertCircle className="h-4 w-4" />
    case 'skipped':
      return <Pause className="h-4 w-4" />
    default:
      return <Circle className="h-4 w-4" />
  }
}

function formatDuration(hours?: number): string {
  if (!hours) return 'N/A'
  if (hours < 1) return `${Math.round(hours * 60)}min`
  if (hours === 1) return '1 hour'
  if (hours < 24) return `${hours} hours`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (remainingHours === 0) return `${days} day${days > 1 ? 's' : ''}`
  return `${days}d ${remainingHours}h`
}

function formatDateTime(dateString?: string): string {
  if (!dateString) return 'Not set'
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch {
    return 'Invalid date'
  }
}

function StepEditModal({ step, isOpen, onClose, onSave }: StepEditModalProps) {
  const [assignedTo, setAssignedTo] = useState(step?.assignedTo || '')
  const [notes, setNotes] = useState(step?.notes || '')
  const [estimatedDuration, setEstimatedDuration] = useState(step?.estimatedDurationHours?.toString() || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    if (!step) return
    
    setIsLoading(true)
    try {
      const updates: Partial<ProcessingStep> = {}
      if (assignedTo) updates.assignedTo = assignedTo
      if (notes) updates.notes = notes
      if (estimatedDuration) updates.estimatedDurationHours = parseInt(estimatedDuration)
      
      await onSave(updates)
      onClose()
      toast.success('Step updated successfully')
    } catch (error) {
      toast.error('Failed to update step')
    } finally {
      setIsLoading(false)
    }
  }

  if (!step) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{STEP_ICONS[step.stepName as keyof typeof STEP_ICONS]}</span>
            Edit {step.stepName}
          </DialogTitle>
          <DialogDescription>
            Update step details and assignment
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Assigned To</label>
            <select 
              value={assignedTo} 
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Select team member</option>
              {TEAM_MEMBERS.map(member => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Estimated Duration (hours)</label>
            <Input
              type="number"
              value={estimatedDuration}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEstimatedDuration(e.target.value)}
              placeholder="e.g., 4"
              min="0"
              step="0.5"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Add any notes or instructions..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function WorkflowSteps({ 
  sampleId, 
  steps, 
  onStepUpdate, 
  onStepComplete, 
  onStepStart,
  readonly = false
}: WorkflowStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [editingStep, setEditingStep] = useState<ProcessingStep | null>(null)
  const [completingStep, setCompletingStep] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const handleStartStep = async (step: ProcessingStep) => {
    try {
      await onStepStart(step.id, step.assignedTo)
      toast.success(`Started ${step.stepName}`)
    } catch (error) {
      toast.error(`Failed to start ${step.stepName}`)
    }
  }

  const handleCompleteStep = async (stepId: string) => {
    try {
      await onStepComplete(stepId, completionNotes || undefined)
      setCompletingStep(null)
      setCompletionNotes('')
      toast.success('Step completed successfully')
    } catch (error) {
      toast.error('Failed to complete step')
    }
  }

  const handleEditStep = (step: ProcessingStep) => {
    setEditingStep(step)
  }

  const handleSaveEdit = async (updates: Partial<ProcessingStep>) => {
    if (!editingStep) return
    await onStepUpdate(editingStep.id, updates)
    setEditingStep(null)
  }

  // Calculate overall progress
  const completedSteps = steps.filter(step => step.stepStatus === 'completed').length
  const totalSteps = steps.length
  const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Workflow Progress</span>
            <Badge variant="outline" className="text-sm">
              {completedSteps} of {totalSteps} steps completed
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Overall Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Processing Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isExpanded = expandedSteps.has(step.id)
              const canStart = step.stepStatus === 'pending' && !readonly
              const canComplete = step.stepStatus === 'in_progress' && !readonly
              const canEdit = !readonly

              return (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {STEP_ICONS[step.stepName as keyof typeof STEP_ICONS]}
                        </span>
                        <span className="text-sm text-gray-500">
                          {index + 1}.
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(step.stepStatus)}
                        <span className="font-medium">{step.stepName}</span>
                      </div>
                      
                      <Badge className={getStatusColor(step.stepStatus)}>
                        {step.stepStatus.replace('_', ' ')}
                      </Badge>
                      
                      {step.assignedTo && (
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <User className="h-3 w-3" />
                          <span>{step.assignedTo}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {step.estimatedDurationHours && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(step.estimatedDurationHours)}</span>
                        </div>
                      )}
                      
                      {canStart && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartStep(step)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                      
                      {canComplete && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCompletingStep(step.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      )}
                      
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditStep(step)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStepExpansion(step.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Started:</span>
                          <div className="text-gray-900">
                            {formatDateTime(step.startedAt)}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Completed:</span>
                          <div className="text-gray-900">
                            {formatDateTime(step.completedAt)}
                          </div>
                        </div>
                      </div>
                      
                      {step.notes && (
                        <div>
                          <span className="font-medium text-gray-600 block mb-1">Notes:</span>
                          <div className="text-gray-900 text-sm bg-gray-50 p-2 rounded">
                            {step.notes}
                          </div>
                        </div>
                      )}
                      
                      {step.resultsData && (
                        <div>
                          <span className="font-medium text-gray-600 block mb-1">Results:</span>
                          <div className="text-gray-900 text-sm bg-gray-50 p-2 rounded">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(step.resultsData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Completion Modal */}
      {completingStep && (
        <Dialog open={true} onOpenChange={() => setCompletingStep(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Complete Step</DialogTitle>
              <DialogDescription>
                Add completion notes for this step
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Completion Notes</label>
                <textarea
                  value={completionNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCompletionNotes(e.target.value)}
                  placeholder="Add any notes about the completion..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setCompletingStep(null)}>
                Cancel
              </Button>
              <Button onClick={() => handleCompleteStep(completingStep)}>
                Complete Step
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Step Edit Modal */}
      <StepEditModal
        step={editingStep}
        isOpen={!!editingStep}
        onClose={() => setEditingStep(null)}
        onSave={handleSaveEdit}
      />
    </div>
  )
} 