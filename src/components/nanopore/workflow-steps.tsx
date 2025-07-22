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
  X,
  MessageSquare,
  AtSign,
  FileText
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

// Enhanced Notes Component
interface EnhancedNotesProps {
  notes: string
  onNotesChange: (notes: string) => void
  readonly?: boolean
  stepName: string
}

function EnhancedNotes({ notes, onNotesChange, readonly = false, stepName }: EnhancedNotesProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(notes)
  const [showMentions, setShowMentions] = useState(false)

  const handleSave = () => {
    onNotesChange(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(notes)
    setIsEditing(false)
  }

  const insertMention = (member: string) => {
    const mention = `@${member} `
    setEditValue(prev => prev + mention)
    setShowMentions(false)
  }

  const formatNotesWithMentions = (text: string) => {
    if (!text) return null
    
    // Split text by @mentions and format them
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const member = part.slice(1)
        return (
          <span key={index} className="bg-blue-100 text-blue-800 px-1 rounded font-medium">
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-600">Notes</span>
        </div>
        {!readonly && !isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="h-7 px-2 text-xs"
          >
            <Edit className="h-3 w-3 mr-1" />
            {notes ? 'Edit' : 'Add Notes'}
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3 bg-gray-50 p-3 rounded-lg border">
          <div className="relative">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={`Add notes for ${stepName}... Use @member to mention team members.`}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMentions(!showMentions)}
                  className="h-7 px-2 text-xs"
                >
                  <AtSign className="h-3 w-3 mr-1" />
                  Mention
                </Button>
                <span className="text-xs text-gray-500">
                  {editValue.length}/500 characters
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-7 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 px-2 text-xs"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </div>

          {showMentions && (
            <div className="bg-white border rounded-md p-2 shadow-sm">
              <div className="text-xs font-medium text-gray-600 mb-2">Mention team member:</div>
              <div className="flex flex-wrap gap-1">
                {TEAM_MEMBERS.filter(member => member !== 'Unassigned').map(member => (
                  <Button
                    key={member}
                    size="sm"
                    variant="outline"
                    onClick={() => insertMention(member)}
                    className="h-6 px-2 text-xs"
                  >
                    @{member}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`text-sm ${notes ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'} p-3 rounded-lg`}>
          {notes ? (
            <div className="space-y-2">
              <div className="text-gray-900 leading-relaxed">
                {formatNotesWithMentions(notes)}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last updated: {new Date().toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 italic flex items-center gap-2">
              <FileText className="h-4 w-4" />
              No notes added yet. Click "Add Notes" to get started.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      {/* Timing Information */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Play className="h-3 w-3 text-gray-500" />
                            <span className="font-medium text-gray-600">Started</span>
                          </div>
                          <div className="text-gray-900">
                            {formatDateTime(step.startedAt)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-3 w-3 text-gray-500" />
                            <span className="font-medium text-gray-600">Completed</span>
                          </div>
                          <div className="text-gray-900">
                            {formatDateTime(step.completedAt)}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3 w-3 text-gray-500" />
                            <span className="font-medium text-gray-600">Duration</span>
                          </div>
                          <div className="text-gray-900">
                            {step.estimatedDurationHours ? formatDuration(step.estimatedDurationHours) : 'Not set'}
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Notes */}
                      <EnhancedNotes
                        notes={step.notes || ''}
                        onNotesChange={(notes) => onStepUpdate(step.id, { notes })}
                        readonly={readonly}
                        stepName={step.stepName}
                      />
                      
                      {step.resultsData && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-gray-600">Results Data</span>
                          </div>
                          <div className="text-gray-900 text-sm bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                            <pre className="whitespace-pre-wrap overflow-x-auto">
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
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Complete Step
              </DialogTitle>
              <DialogDescription>
                Mark this step as completed and add completion notes
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="text-sm font-medium mb-2 block">Quick Completion Templates</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionNotes('✅ Completed successfully with no issues.')}
                    className="justify-start text-xs"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Success - No Issues
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionNotes('⚠️ Completed with minor issues. See notes below.')}
                    className="justify-start text-xs"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Success - Minor Issues
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionNotes('📋 QC passed. Ready for next step.')}
                    className="justify-start text-xs"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    QC Passed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionNotes('🔄 Requires follow-up: ')}
                    className="justify-start text-xs"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Needs Follow-up
                  </Button>
                </div>
              </div>

              {/* Enhanced Note Editor */}
              <div>
                <label className="text-sm font-medium mb-2 block">Completion Notes</label>
                <div className="relative">
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Add detailed completion notes... Use @member to mention team members for follow-up tasks."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {completionNotes.length}/500 characters
                    </span>
                    <div className="flex gap-1">
                      {TEAM_MEMBERS.filter(member => member !== 'Unassigned').map(member => (
                        <Button
                          key={member}
                          size="sm"
                          variant="outline"
                          onClick={() => setCompletionNotes(prev => prev + `@${member} `)}
                          className="h-6 px-2 text-xs"
                        >
                          @{member}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setCompletingStep(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleCompleteStep(completingStep)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
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