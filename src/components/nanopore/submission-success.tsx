'use client'

import { CheckCircle, Download, FileText, Home } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SubmissionData } from '@/types/submission'

interface SubmissionSuccessProps {
  submissionData: SubmissionData
  onStartOver: () => void
}

export function SubmissionSuccess({ submissionData, onStartOver }: SubmissionSuccessProps) {
  const handleDownloadReceipt = () => {
    // Generate a simple receipt
    const receipt = `
NANOPORE SAMPLE SUBMISSION RECEIPT
==================================

Submission ID: ${submissionData.id}
Date: ${submissionData.submissionDate.toLocaleString()}
Status: ${submissionData.status}

SAMPLE DETAILS:
${submissionData.samples.map(sample => `
Sample Name: ${sample.sampleName}
Submitter: ${sample.submitterName} (${sample.submitterEmail})
Organism: ${sample.organism || 'N/A'}
Concentration: ${sample.concentration || 'N/A'} ng/μl
Volume: ${sample.volume || 'N/A'} μl
Buffer: ${sample.buffer || 'N/A'}
Type: ${sample.sampleType || 'N/A'}
`).join('\n')}

Thank you for your submission!
    `.trim()

    const blob = new Blob([receipt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `submission-receipt-${submissionData.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-900">Submission Successful!</CardTitle>
          <CardDescription className="text-green-700">
            Your sample has been successfully submitted to the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Submission ID:</span>
              <span className="text-sm font-mono font-medium">{submissionData.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Sample Name:</span>
              <span className="text-sm font-medium">{submissionData.samples[0]?.sampleName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Submitted By:</span>
              <span className="text-sm">{submissionData.samples[0]?.submitterName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Date:</span>
              <span className="text-sm">{submissionData.submissionDate.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Your sample will be processed by our laboratory team</li>
              <li>• You'll receive email updates on the progress</li>
              <li>• Results will be available in 2-3 business days</li>
              <li>• You can track your sample status using the submission ID</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={handleDownloadReceipt}>
          <Download className="h-4 w-4 mr-2" />
          Download Receipt
        </Button>
        <Button onClick={onStartOver}>
          <FileText className="h-4 w-4 mr-2" />
          Submit Another Sample
        </Button>
        <Button variant="outline" asChild>
          <a href="/">
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </a>
        </Button>
      </div>
    </div>
  )
}