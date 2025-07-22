import { 
  ExternalLink, 
  Calendar, 
  User, 
  Mail, 
  TestTube, 
  Building, 
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  Archive,
  Flag,
  Download
} from 'lucide-react'

import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import WorkflowSteps from './workflow-steps'
import { trpc } from '@/client/trpc'
import { toast } from 'sonner'

// Helper function to safely format dates
const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Not available'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString()
  } catch (error) {
    return 'Invalid date'
  }
}

const formatDateTime = (date: Date | string | null | undefined): { date: string; time: string } => {
  if (!date) return { date: 'Not available', time: '' }
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return {
      date: dateObj.toLocaleDateString(),
      time: dateObj.toLocaleTimeString()
    }
  } catch (error) {
    return { date: 'Invalid date', time: '' }
  }
}

type NanoporeSample = {
  id: string
  sampleName: string
  projectId: string | null
  submitterName: string
  submitterEmail: string
  labName: string | null
  sampleType: string
  status: string | null
  priority: string | null
  assignedTo: string | null
  libraryPrepBy: string | null
  submittedAt: Date
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

interface ViewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  sample: NanoporeSample | null
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case 'submitted':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'prep':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'sequencing':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'analysis':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'archived':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getPriorityColor(priority: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'normal':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case 'submitted':
      return <Clock className="h-4 w-4" />
    case 'prep':
      return <Play className="h-4 w-4" />
    case 'sequencing':
      return <TestTube className="h-4 w-4" />
    case 'analysis':
      return <AlertCircle className="h-4 w-4" />
    case 'completed':
      return <CheckCircle className="h-4 w-4" />
    case 'archived':
      return <Archive className="h-4 w-4" />
    default:
      return <Pause className="h-4 w-4" />
  }
}

export function ViewTaskModal({
  isOpen,
  onClose,
  sample,
}: ViewTaskModalProps) {
  // Fetch processing steps for the sample
  const { data: processingSteps = [], refetch: refetchSteps } = trpc.nanopore.getProcessingSteps.useQuery(
    sample?.id || '', 
    { enabled: !!sample?.id }
  )

  const updateStepMutation = trpc.nanopore.updateProcessingStep.useMutation({
    onSuccess: () => {
      refetchSteps()
    }
  })

  const startStepMutation = trpc.nanopore.startProcessingStep.useMutation({
    onSuccess: () => {
      refetchSteps()
    }
  })

  const completeStepMutation = trpc.nanopore.completeProcessingStep.useMutation({
    onSuccess: () => {
      refetchSteps()
    }
  })

  const handleStepUpdate = async (stepId: string, updates: any) => {
    await updateStepMutation.mutateAsync({ stepId, updates })
  }

  const handleStepStart = async (stepId: string, assignedTo?: string) => {
    await startStepMutation.mutateAsync({ stepId, assignedTo })
  }

  const handleStepComplete = async (stepId: string, notes?: string, resultsData?: any) => {
    await completeStepMutation.mutateAsync({ stepId, notes, resultsData })
  }

  // Export sample data
  const exportSampleData = (format: 'json' | 'csv') => {
    if (!sample) return

    try {
      let content: string
      let filename: string
      let mimeType: string

      if (format === 'json') {
        content = JSON.stringify({
          sample: {
            id: sample.id,
            sampleName: sample.sampleName,
            projectId: sample.projectId,
            submitterName: sample.submitterName,
            submitterEmail: sample.submitterEmail,
            labName: sample.labName,
            sampleType: sample.sampleType,
            status: sample.status,
            priority: sample.priority,
            assignedTo: sample.assignedTo,
            libraryPrepBy: sample.libraryPrepBy,
            submittedAt: sample.submittedAt,
            createdAt: sample.createdAt,
            updatedAt: sample.updatedAt,
            createdBy: sample.createdBy
          },
          processingSteps: processingSteps,
          exportedAt: new Date().toISOString()
        }, null, 2)
        filename = `sample-${sample.sampleName}-${new Date().toISOString().split('T')[0]}.json`
        mimeType = 'application/json'
      } else {
        // CSV format
        const csvHeader = 'Field,Value\n'
        const csvRows = [
          ['Sample ID', sample.id],
          ['Sample Name', sample.sampleName],
          ['Project ID', sample.projectId || ''],
          ['Submitter Name', sample.submitterName],
          ['Submitter Email', sample.submitterEmail],
          ['Lab Name', sample.labName || ''],
          ['Sample Type', sample.sampleType],
          ['Status', sample.status || ''],
          ['Priority', sample.priority || ''],
          ['Assigned To', sample.assignedTo || ''],
          ['Library Prep By', sample.libraryPrepBy || ''],
          ['Submitted At', sample.submittedAt?.toISOString() || ''],
          ['Created At', sample.createdAt?.toISOString() || ''],
          ['Updated At', sample.updatedAt?.toISOString() || ''],
          ['Created By', sample.createdBy || '']
        ].map(row => `"${row[0]}","${row[1]}"`).join('\n')

        content = csvHeader + csvRows
        filename = `sample-${sample.sampleName}-${new Date().toISOString().split('T')[0]}.csv`
        mimeType = 'text/csv'
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Sample data exported as ${format.toUpperCase()}`, {
        description: `Downloaded ${filename}`
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  if (!sample) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Sample Details & Workflow
          </DialogTitle>
          <DialogDescription>
            View detailed information and processing status for {sample.sampleName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sample Name and Status */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{sample.sampleName}</h3>
            <div className="flex gap-2">
              <Badge className={getStatusColor(sample.status)}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(sample.status)}
                  {sample.status || 'unknown'}
                </div>
              </Badge>
              <Badge className={getPriorityColor(sample.priority)}>
                <div className="flex items-center gap-1">
                  <Flag className="h-3 w-3" />
                  {sample.priority || 'normal'}
                </div>
              </Badge>
            </div>
          </div>

          {/* Processing Steps */}
          <div className="border-t pt-4">
            <WorkflowSteps
              sampleId={sample.id}
              steps={processingSteps}
              onStepUpdate={handleStepUpdate}
              onStepStart={handleStepStart}
              onStepComplete={handleStepComplete}
              readonly={false}
            />
          </div>

          {/* Sample Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TestTube className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Sample Type</p>
                  <p className="text-sm text-muted-foreground">{sample.sampleType}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Project ID</p>
                  <p className="text-sm text-muted-foreground">
                    {sample.projectId || 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Lab Name</p>
                  <p className="text-sm text-muted-foreground">
                    {sample.labName || 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Submitter</p>
                  <p className="text-sm text-muted-foreground">{sample.submitterName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{sample.submitterEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(sample.submittedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Information */}
          {(sample.assignedTo || sample.libraryPrepBy) && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Assignment Information</h4>
              <div className="grid grid-cols-2 gap-4">
                {sample.assignedTo && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Assigned To</p>
                      <p className="text-sm text-muted-foreground">{sample.assignedTo}</p>
                    </div>
                  </div>
                )}
                {sample.libraryPrepBy && (
                  <div className="flex items-center gap-2">
                    <TestTube className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Library Prep By</p>
                      <p className="text-sm text-muted-foreground">{sample.libraryPrepBy}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Information */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Timeline</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">Created:</span>{' '}
                    {(() => {
                      const { date, time } = formatDateTime(sample.createdAt)
                      return time ? `${date} at ${time}` : date
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">Last Updated:</span>{' '}
                    {(() => {
                      const { date, time } = formatDateTime(sample.updatedAt)
                      return time ? `${date} at ${time}` : date
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">System Information</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium">Sample ID:</span> {sample.id}</p>
              <p><span className="font-medium">Created By:</span> {sample.createdBy}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t pt-4">
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => exportSampleData('csv')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportSampleData('json')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}