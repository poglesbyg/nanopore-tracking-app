'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { submissionServiceClient } from '@/lib/submission-client'
import type { ExtractedData, ProcessingResult } from '@/types/submission'

interface PdfUploaderProps {
  onDataExtracted: (data: ExtractedData) => void
}

export function PdfUploader({ onDataExtracted }: PdfUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setIsProcessing(true)
    setError(null)
    setProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 200)

    try {
      const result = await submissionServiceClient.processPDF(file)
      
      clearInterval(progressInterval)
      setProgress(100)

      if (result.success && (result as any).extractedData) {
        // Convert backend format to frontend format
        const extractedData: ExtractedData = {
          sampleName: (result as any).extractedData.sample_name,
          submitterName: (result as any).extractedData.submitter_name,
          submitterEmail: (result as any).extractedData.submitter_email,
          organism: (result as any).extractedData.organism,
          concentration: (result as any).extractedData.concentration,
          volume: (result as any).extractedData.volume,
          buffer: (result as any).extractedData.buffer,
          quoteIdentifier: (result as any).extractedData.quote_identifier,
          labName: (result as any).extractedData.lab_name,
          phone: (result as any).extractedData.phone,
          sampleType: (result as any).extractedData.sample_type,
          flowCell: (result as any).extractedData.flow_cell,
          genomeSize: (result as any).extractedData.genome_size,
          coverage: (result as any).extractedData.coverage,
          piName: (result as any).extractedData.pi_name,
          department: (result as any).extractedData.department,
          confidence: (result as any).extractedData.confidence || 0.8,
          extractionMethod: (result as any).extractedData._ai_enhanced ? 'ai' : 'pattern',
          sampleTable: (result as any).extractedData.sample_table
        }

        setTimeout(() => {
          onDataExtracted(extractedData)
        }, 500)
      } else {
        setError(result.message || 'Failed to extract data from PDF')
      }
    } catch (err) {
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : 'Failed to process PDF')
    } finally {
      setIsProcessing(false)
    }
  }, [onDataExtracted])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload PDF Document</CardTitle>
        <CardDescription>
          Upload your nanopore sample submission form and we'll automatically extract the information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {isProcessing ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
              <p className="text-lg font-medium">Processing PDF...</p>
              <p className="text-sm text-gray-600">Extracting sample information</p>
              <Progress value={progress} className="w-64 mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                {isDragActive ? (
                  <FileText className="h-8 w-8 text-blue-600" />
                ) : (
                  <Upload className="h-8 w-8 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                </p>
                <p className="text-sm text-gray-600 mt-1">or click to browse</p>
              </div>
              <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}