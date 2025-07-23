'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { Input } from '../ui/input'
import { trpc } from '@/client/trpc'
import { MCPEnhancedDashboard } from './mcp-enhanced-dashboard'
import { 
  ChevronDown, 
  ChevronRight, 
  Calendar, 
  User, 
  TestTube, 
  FileText,
  Search,
  Plus,
  Brain,
  Lightbulb,
  TrendingUp
} from 'lucide-react'

interface SubmissionDashboardProps {
  className?: string
}

export function SubmissionDashboard({ className = '' }: SubmissionDashboardProps) {
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeView, setActiveView] = useState<'submissions' | 'ai-assistant'>('submissions')
  const pageSize = 10

  const { data: submissions, isLoading, error, refetch } = trpc.nanoporeSubmission.getAllPaginated.useQuery({
    page: currentPage,
    limit: pageSize,
    search: searchTerm
  })

  const toggleSubmission = (submissionId: string) => {
    const newExpanded = new Set(expandedSubmissions)
    if (newExpanded.has(submissionId)) {
      newExpanded.delete(submissionId)
    } else {
      newExpanded.add(submissionId)
    }
    setExpandedSubmissions(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Error loading submissions: {error.message}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with View Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nanopore Submissions</h2>
          <p className="text-gray-600">Manage and track nanopore sequencing submissions</p>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <Button
            variant={activeView === 'submissions' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('submissions')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Submissions
          </Button>
          <Button
            variant={activeView === 'ai-assistant' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('ai-assistant')}
            className="flex items-center gap-2"
          >
            <Brain className="h-4 w-4" />
            AI Assistant
          </Button>
        </div>
      </div>

      {/* AI Assistant View */}
      {activeView === 'ai-assistant' && (
        <div className="space-y-6">
          {/* AI Assistant Introduction */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-blue-600" />
                AI-Powered Laboratory Intelligence
                <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-800">
                  MCP Enabled
                </Badge>
              </CardTitle>
              <CardDescription>
                Get intelligent assistance for protocol recommendations, quality assessment, and workflow optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <Lightbulb className="h-8 w-8 text-yellow-500" />
                  <div>
                    <div className="font-medium">Smart Protocols</div>
                    <div className="text-sm text-gray-600">AI recommends optimal sequencing protocols</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <TestTube className="h-8 w-8 text-purple-500" />
                  <div>
                    <div className="font-medium">Quality Analysis</div>
                    <div className="text-sm text-gray-600">Intelligent sample quality assessment</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <div className="font-medium">Workflow Insights</div>
                    <div className="text-sm text-gray-600">Performance optimization suggestions</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MCP Enhanced Dashboard */}
          <MCPEnhancedDashboard 
            submissionId={submissions?.data?.[0]?.id}
            sampleData={submissions?.data?.[0]?.samples?.[0]}
          />
        </div>
      )}

      {/* Submissions View */}
      {activeView === 'submissions' && (
        <>
          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Submission
            </Button>
          </div>

          {/* Submissions List */}
          <div className="space-y-4">
            {submissions?.data?.map((submission) => (
              <Card key={submission.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  {/* Submission Header */}
                  <div 
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleSubmission(submission.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {expandedSubmissions.has(submission.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {submission.submission_number}
                            </h3>
                            <Badge className={getStatusColor(submission.status)}>
                              {submission.status}
                            </Badge>
                            <Badge className={getPriorityColor(submission.priority)}>
                              {submission.priority}
                            </Badge>
                          </div>
                          
                          <div className="mt-2 flex items-center text-sm text-gray-500 space-x-6">
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span>{submission.submitter_name}</span>
                            </div>
                            {submission.lab_name && (
                              <div className="flex items-center space-x-1">
                                <TestTube className="h-4 w-4" />
                                <span>{submission.lab_name}</span>
                              </div>
                            )}
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(submission.submission_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <TestTube className="h-4 w-4" />
                              <span>{submission.total_samples} samples</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedSubmissions.has(submission.id) && (
                    <div className="border-t bg-gray-50 p-6">
                      <div className="space-y-4">
                        {/* Submission Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Submission Details</h4>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-gray-600">Project:</span>
                                <span className="ml-2 font-medium">{submission.project_name || 'Not specified'}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Submitter Email:</span>
                                <span className="ml-2 font-medium">{submission.submitter_email}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Created:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(submission.created_at).toLocaleString()}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Last Updated:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(submission.updated_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* AI Assistant Quick Access */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                              <Brain className="h-4 w-4 text-blue-600" />
                              AI Assistant
                            </h4>
                            <div className="space-y-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveView('ai-assistant')}
                                className="w-full justify-start"
                              >
                                <Lightbulb className="h-4 w-4 mr-2" />
                                Get Protocol Recommendations
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveView('ai-assistant')}
                                className="w-full justify-start"
                              >
                                <TestTube className="h-4 w-4 mr-2" />
                                Assess Sample Quality
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Sample Information */}
                        {submission.samples && submission.samples.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">
                              Samples ({submission.samples.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {submission.samples.slice(0, 6).map((sample, index) => (
                                <div key={index} className="bg-white p-3 rounded border">
                                  <div className="font-medium text-sm">{sample.sample_name}</div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    <div>Type: {sample.sample_type}</div>
                                    {sample.concentration && (
                                      <div>Conc: {sample.concentration} ng/μL</div>
                                    )}
                                    <div>Status: {sample.status}</div>
                                  </div>
                                </div>
                              ))}
                              {submission.samples.length > 6 && (
                                <div className="bg-gray-100 p-3 rounded border flex items-center justify-center text-sm text-gray-600">
                                  +{submission.samples.length - 6} more samples
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4 border-t">
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                          <Button variant="outline" size="sm">
                            Edit Submission
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setActiveView('ai-assistant')}
                            className="ml-auto"
                          >
                            <Brain className="h-4 w-4 mr-2" />
                            AI Assistant
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {submissions?.pagination && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((submissions.pagination.page - 1) * submissions.pagination.limit) + 1} to{' '}
                {Math.min(submissions.pagination.page * submissions.pagination.limit, submissions.pagination.total)} of{' '}
                {submissions.pagination.total} submissions
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={!submissions.pagination.hasPrevPage}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(submissions.pagination.totalPages, currentPage + 1))}
                  disabled={!submissions.pagination.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {submissions?.data?.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first submission'}
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Submission
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
} 