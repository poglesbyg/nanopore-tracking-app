'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { Badge } from '../ui/badge'
import { Input } from '../ui/input'
import { trpc } from '@/client/trpc'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { PriorityBadge } from '@/shared/components/PriorityBadge'
import PDFUpload from './pdf-upload'
import { processPDFSubmission } from '@/lib/ai/pdf-submission-processor'
import {
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  User,
  Trash2,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import type { NanoporeSubmission } from '@/types/nanopore-submission'

interface SimpleSample {
  id: string
  sample_number: number
  sample_name: string
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  flow_cell_type?: string
  concentration?: number
  volume?: number
}

const SubmissionStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-600" />
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-600" />
    case 'processing':
      return <Clock className="h-5 w-5 text-blue-600" />
    default:
      return <AlertCircle className="h-5 w-5 text-yellow-600" />
  }
}

export default function SubmissionDashboard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set())
  const [showPdfUploadModal, setShowPdfUploadModal] = useState(false)
  
  // Fetch submissions with pagination
  const { data: submissionsData, isLoading, refetch } = trpc.nanoporeSubmission.getAllPaginated.useQuery({
    page: 1,
    limit: 20,
    search: searchQuery || undefined,
  })
  
  // Mutations
  const createSubmissionMutation = trpc.nanoporeSubmission.createWithSamples.useMutation({
    onSuccess: () => {
      toast.success('Submission created successfully!')
      refetch()
      setShowPdfUploadModal(false)
    },
    onError: (error) => {
      toast.error(`Failed to create submission: ${error.message}`)
    },
  })
  
  const deleteSubmissionMutation = trpc.nanoporeSubmission.delete.useMutation({
    onSuccess: () => {
      toast.success('Submission deleted successfully')
      refetch()
    },
    onError: (error) => {
      toast.error(`Failed to delete submission: ${error.message}`)
    },
  })
  
  // Toggle submission expansion
  const toggleSubmission = (submissionId: string) => {
    const newExpanded = new Set(expandedSubmissions)
    if (newExpanded.has(submissionId)) {
      newExpanded.delete(submissionId)
    } else {
      newExpanded.add(submissionId)
    }
    setExpandedSubmissions(newExpanded)
  }
  
  // Handle PDF upload
  const handlePDFUpload = async (data: any, file: File) => {
    try {
      // Process the PDF to extract submission and sample data
      const result = await processPDFSubmission(file)
      
      // Map samples to the format expected by the API
      const samples = result.samples.map((sample, index) => ({
        sample_name: sample.sample_name,
        sample_type: (sample.sample_type || 'DNA') as 'DNA' | 'RNA' | 'Protein' | 'Other',
        concentration: sample.concentration,
        volume: sample.volume,
        flow_cell_type: sample.flow_cell_type as 'R9.4.1' | 'R10.4.1' | 'R10.5.1' | 'Other' | undefined,
        priority: 'normal' as const,
      }))
      
      // Create submission with samples
      await createSubmissionMutation.mutateAsync({
        submission: result.submission,
        samples,
      })
    } catch (error) {
      console.error('Failed to process PDF:', error)
      toast.error('Failed to process PDF submission')
    }
  }
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }
  
  const submissions = submissionsData?.data || []
  const pagination = submissionsData?.pagination
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nanopore Submissions</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total || 0} total submissions
          </p>
        </div>
        <Button onClick={() => setShowPdfUploadModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Submission
        </Button>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search submissions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Submissions List */}
      <div className="space-y-4">
        {submissions.map((submission) => (
          <Card key={submission.id} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSubmission(submission.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {expandedSubmissions.has(submission.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-lg">
                        {submission.submission_number}
                      </h3>
                      <SubmissionStatusIcon status={submission.status} />
                      <Badge variant="outline">{submission.status}</Badge>
                      <PriorityBadge priority={submission.priority} />
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{submission.submitter_name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(submission.submission_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        {submission.sample_count} samples 
                        ({submission.samples_completed} completed)
                      </div>
                    </div>
                    
                    {submission.lab_name && (
                      <div className="text-sm text-gray-500 mt-1">
                        Lab: {submission.lab_name}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      // View submission details
                      toast.info('View details coming soon')
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Download submission data
                      toast.info('Download coming soon')
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm('Are you sure you want to delete this submission?')) {
                        deleteSubmissionMutation.mutate({ id: submission.id })
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* Expanded Sample List */}
            {expandedSubmissions.has(submission.id) && (
              <CardContent>
                <SubmissionSamples submissionId={submission.id} />
              </CardContent>
            )}
          </Card>
        ))}
        
        {submissions.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
            <p className="text-gray-500 mb-4">
              Get started by uploading a PDF submission form
            </p>
            <Button onClick={() => setShowPdfUploadModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Submission
            </Button>
          </div>
        )}
      </div>
      
      {/* PDF Upload Modal */}
      {showPdfUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload PDF Submission</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPdfUploadModal(false)}
              >
                ✕
              </Button>
            </div>
            <PDFUpload
              onDataExtracted={handlePDFUpload}
              onFileUploaded={(file) => {
                console.log('PDF uploaded:', file)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Component to load and display samples for a submission
function SubmissionSamples({ submissionId }: { submissionId: string }) {
  const { data, isLoading } = trpc.nanoporeSubmission.getWithSamples.useQuery({
    id: submissionId,
  })
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }
  
  const samples = data?.samples || []
  
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-gray-700 mb-2">Samples in this submission:</h4>
      {samples.map((sample) => (
        <div
          key={sample.id}
          className="border rounded-md p-3 hover:bg-gray-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">
                  #{sample.sample_number}: {sample.sample_name}
                </span>
                <StatusBadge status={sample.status} />
                <PriorityBadge priority={sample.priority} />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {sample.flow_cell_type && `Flow cell: ${sample.flow_cell_type}`}
                {sample.concentration && ` • Conc: ${sample.concentration} ng/μL`}
                {sample.volume && ` • Vol: ${sample.volume} μL`}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Navigate to sample details
                  toast.info('Sample details coming soon')
                }}
              >
                View
              </Button>
            </div>
          </div>
        </div>
      ))}
      
      {samples.length === 0 && (
        <p className="text-gray-500 italic">No samples in this submission</p>
      )}
    </div>
  )
} 