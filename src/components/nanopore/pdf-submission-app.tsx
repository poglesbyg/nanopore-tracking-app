'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { PdfUploader } from './pdf-uploader'
import { SubmissionForm } from './submission-form'
import { SubmissionSuccess } from './submission-success'
import type { ExtractedData, SubmissionData } from '@/types/submission'

type WorkflowStep = 'upload' | 'review' | 'success'

export function PdfSubmissionApp() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload')
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)

  const handleDataExtracted = (data: ExtractedData) => {
    setExtractedData(data)
    setCurrentStep('review')
  }

  const handleSubmissionComplete = (data: SubmissionData) => {
    setSubmissionData(data)
    setCurrentStep('success')
  }

  const handleStartOver = () => {
    setCurrentStep('upload')
    setExtractedData(null)
    setSubmissionData(null)
  }

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          <StepIndicator
            step={1}
            label="Upload PDF"
            status={currentStep === 'upload' ? 'active' : currentStep !== 'upload' ? 'complete' : 'pending'}
          />
          <div className={`h-px w-16 ${currentStep !== 'upload' ? 'bg-blue-500' : 'bg-gray-300'}`} />
          <StepIndicator
            step={2}
            label="Review & Submit"
            status={currentStep === 'review' ? 'active' : currentStep === 'success' ? 'complete' : 'pending'}
          />
          <div className={`h-px w-16 ${currentStep === 'success' ? 'bg-blue-500' : 'bg-gray-300'}`} />
          <StepIndicator
            step={3}
            label="Complete"
            status={currentStep === 'success' ? 'active' : 'pending'}
          />
        </div>
      </div>

      {/* Main Content */}
      {currentStep === 'upload' && (
        <PdfUploader onDataExtracted={handleDataExtracted} />
      )}

      {currentStep === 'review' && extractedData && (
        <SubmissionForm
          extractedData={extractedData}
          onSubmit={handleSubmissionComplete}
          onBack={() => setCurrentStep('upload')}
        />
      )}

      {currentStep === 'success' && submissionData && (
        <SubmissionSuccess
          submissionData={submissionData}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  )
}

interface StepIndicatorProps {
  step: number
  label: string
  status: 'pending' | 'active' | 'complete'
}

function StepIndicator({ step, label, status }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center font-semibold
          ${status === 'active' ? 'bg-blue-500 text-white' : ''}
          ${status === 'complete' ? 'bg-green-500 text-white' : ''}
          ${status === 'pending' ? 'bg-gray-200 text-gray-500' : ''}
        `}
      >
        {status === 'complete' ? '✓' : step}
      </div>
      <span className={`text-sm mt-2 ${status === 'active' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  )
}