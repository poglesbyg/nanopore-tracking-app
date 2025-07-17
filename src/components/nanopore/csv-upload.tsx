'use client'

import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  Download,
  Table,
  CheckSquare,
  XSquare,
} from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { trpc } from '@/client/trpc'

interface CSVUploadProps {
  onSamplesCreated?: (samples: any[], file: File) => void
  onFileUploaded?: (file: File) => void
}

interface UploadedFile {
  file: File
  id: string
  status: 'processing' | 'completed' | 'error'
  parsedData?: any[]
  error?: string
  processingTime?: number
  validationResults?: ValidationResult[]
}

interface ValidationResult {
  row: number
  sampleName: string
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export default function CSVUpload({
  onSamplesCreated,
  onFileUploaded,
}: CSVUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null)
  const [isClient, setIsClient] = useState(false)

  // tRPC mutations
  const createSampleMutation = trpc.nanopore.create.useMutation()
  const createDefaultStepsMutation = trpc.nanopore.createDefaultProcessingSteps.useMutation()

  // Ensure client-side rendering
  useEffect(() => {
    setIsClient(true)
  }, [])

  const parseCSV = useCallback((csvText: string): any[] => {
    const lines = csvText.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row')
    }

    const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || []
    const data: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]?.split(',').map(v => v.trim().replace(/"/g, '')) || []
      const row: any = {}
      
      headers.forEach((header, index) => {
        row[header] = values[index] ?? ''
      })
      
      data.push(row)
    }

    return data
  }, [])

  const validateRow = useCallback((row: any, rowIndex: number): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []
    let isValid = true

    // Required field validation
    if (!row.sample_name?.trim()) {
      errors.push('Sample name is required')
      isValid = false
    }

    if (!row.submitter_name?.trim()) {
      errors.push('Submitter name is required')
      isValid = false
    }

    if (!row.submitter_email?.trim()) {
      errors.push('Submitter email is required')
      isValid = false
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(row.submitter_email)) {
        errors.push('Invalid email format')
        isValid = false
      }
    }

    if (!row.sample_type?.trim()) {
      errors.push('Sample type is required')
      isValid = false
    } else {
      const validTypes = ['DNA', 'RNA', 'Protein', 'Other']
      if (!validTypes.includes(row.sample_type)) {
        errors.push('Sample type must be DNA, RNA, Protein, or Other')
        isValid = false
      }
    }

    if (!row.chart_field?.trim()) {
      errors.push('Chart field is required')
      isValid = false
    } else {
      const chartFieldRegex = /^(HTSF|NANO|SEQ)-\d{3}$/
      if (!chartFieldRegex.test(row.chart_field)) {
        errors.push('Chart field must be in format: HTSF-001, NANO-001, or SEQ-001')
        isValid = false
      }
    }

    // Optional field validation
    if (row.concentration && isNaN(Number(row.concentration))) {
      warnings.push('Concentration should be a number')
    }

    if (row.volume && isNaN(Number(row.volume))) {
      warnings.push('Volume should be a number')
    }

    if (row.total_amount && isNaN(Number(row.total_amount))) {
      warnings.push('Total amount should be a number')
    }

    // Priority validation
    if (row.priority && !['low', 'normal', 'high', 'urgent'].includes(row.priority)) {
      warnings.push('Priority should be low, normal, high, or urgent')
    }

    // Flow cell type validation
    if (row.flow_cell_type && !['R9.4.1', 'R10.4.1', 'R10.5.1', 'Other'].includes(row.flow_cell_type)) {
      warnings.push('Flow cell type should be R9.4.1, R10.4.1, R10.5.1, or Other')
    }

    return {
      row: rowIndex + 1,
      sampleName: row.sample_name || 'Unknown',
      isValid,
      errors,
      warnings
    }
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random()}`,
        status: 'processing' as const,
      }))

      setUploadedFiles((prev) => [...prev, ...newFiles])
      setIsProcessing(true)

      // Process each file
      for (const uploadedFile of newFiles) {
        try {
          // Call the file uploaded callback
          onFileUploaded?.(uploadedFile.file)

          // Read and parse CSV
          const startTime = Date.now()
          const csvText = await uploadedFile.file.text()
          const parsedData = parseCSV(csvText)
          const processingTime = Date.now() - startTime

                     // Validate each row
           const validationResults = parsedData.map((row, index) => validateRow(row, index))
           const validRows = validationResults.filter(result => result.isValid)
           const invalidRows = validationResults.filter(result => !result.isValid)

           if (invalidRows.length > 0) {
             // Update file with validation errors
             setUploadedFiles((prev) =>
               prev.map((f) =>
                 f.id === uploadedFile.id
                   ? {
                       ...f,
                       status: 'error',
                       error: `${invalidRows.length} rows have validation errors`,
                       processingTime,
                       validationResults,
                     }
                   : f,
               ),
             )
           } else {
             // All rows are valid, create samples
             const createdSamples: any[] = []
             
             for (let i = 0; i < parsedData.length; i++) {
               const row = parsedData[i]
               const validationResult = validationResults[i]
               
               if (validationResult && validationResult.isValid) {
                 try {
                   const sampleData = {
                     sampleName: row.sample_name,
                     projectId: row.project_id || undefined,
                     submitterName: row.submitter_name,
                     submitterEmail: row.submitter_email,
                     labName: row.lab_name || undefined,
                     sampleType: row.sample_type,
                     sampleBuffer: row.sample_buffer || undefined,
                     concentration: row.concentration ? Number(row.concentration) : undefined,
                     volume: row.volume ? Number(row.volume) : undefined,
                     totalAmount: row.total_amount ? Number(row.total_amount) : undefined,
                     flowCellType: row.flow_cell_type || undefined,
                     flowCellCount: row.flow_cell_count ? Number(row.flow_cell_count) : 1,
                     priority: row.priority || 'normal',
                     assignedTo: row.assigned_to || undefined,
                     libraryPrepBy: row.library_prep_by || undefined,
                     chartField: row.chart_field,
                   }

                   const sample = await createSampleMutation.mutateAsync(sampleData)
                   
                   // Create default processing steps
                   await createDefaultStepsMutation.mutateAsync(sample.id)
                   
                   createdSamples.push(sample)
                 } catch (error) {
                   console.error(`Failed to create sample ${row.sample_name}:`, error)
                   // Continue with other samples even if one fails
                 }
               }
             }

            // Update file status
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? {
                      ...f,
                      status: 'completed' as const,
                      parsedData: createdSamples,
                      processingTime,
                      validationResults,
                    }
                  : f,
              ),
            )

            // Call the samples created callback
            if (createdSamples.length > 0) {
              onSamplesCreated?.(createdSamples, uploadedFile.file)
              toast.success(`Successfully created ${createdSamples.length} samples from CSV`)
            }
          }
        } catch (error) {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                  }
                : f,
            ),
          )
        }
      }

      setIsProcessing(false)
    },
    [onSamplesCreated, onFileUploaded, parseCSV, validateRow, createSampleMutation, createDefaultStepsMutation],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: true,
    maxSize: 5 * 1024 * 1024, // 5MB
  })

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const viewFile = useCallback((uploadedFile: UploadedFile) => {
    setViewingFile(uploadedFile)
  }, [])

  const closeViewer = useCallback(() => {
    setViewingFile(null)
  }, [])

  const downloadTemplate = useCallback(() => {
    const template = `sample_name,project_id,submitter_name,submitter_email,lab_name,sample_type,sample_buffer,concentration,volume,total_amount,flow_cell_type,flow_cell_count,priority,assigned_to,library_prep_by,chart_field
SAMPLE001,HTSF-001,John Doe,john.doe@university.edu,Genomics Lab,DNA,Tris-EDTA,50.5,20.0,1010.0,R9.4.1,1,normal,Dr. Smith,Stephanie,HTSF-001
RNA_SAMPLE_002,NANO-002,Jane Wilson,jane.wilson@lab.org,RNA Sequencing Lab,RNA,RNase-free water,25.0,50.0,1250.0,R10.4.1,1,high,Grey,Jenny,NANO-002`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nanopore-sample-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
        )
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
    }
  }

  // Loading state
  if (!isClient) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <span>CSV Upload & Sample Creation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // File viewer modal
  if (viewingFile) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[95vh] overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <Table className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {viewingFile.file.name}
                </span>
                <Badge variant="outline" className="ml-2">
                  {(viewingFile.file.size / 1024 / 1024).toFixed(2)} MB
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={closeViewer}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {viewingFile.validationResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Validation Results</h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <CheckSquare className="h-4 w-4 text-green-600" />
                        <span className="text-sm">
                          {viewingFile.validationResults.filter(r => r.isValid).length} Valid
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XSquare className="h-4 w-4 text-red-600" />
                        <span className="text-sm">
                          {viewingFile.validationResults.filter(r => !r.isValid).length} Invalid
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {viewingFile.validationResults.map((result, index) => (
                      <Card key={index} className={result.isValid ? 'border-green-200' : 'border-red-200'}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-2">
                                {result.isValid ? (
                                  <CheckSquare className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XSquare className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium">Row {result.row}: {result.sampleName}</span>
                                <Badge className={result.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                  {result.isValid ? 'Valid' : 'Invalid'}
                                </Badge>
                              </div>
                              
                              {result.errors.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium text-red-600">Errors:</p>
                                  <ul className="text-sm text-red-600 ml-4">
                                    {result.errors.map((error, i) => (
                                      <li key={i}>• {error}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {result.warnings.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm font-medium text-yellow-600">Warnings:</p>
                                  <ul className="text-sm text-yellow-600 ml-4">
                                    {result.warnings.map((warning, i) => (
                                      <li key={i}>• {warning}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <span>CSV Upload & Sample Creation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  {isDragActive
                    ? 'Drop CSV files here'
                    : 'Upload CSV Spreadsheets'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Drag & drop CSV files or click to browse (max 5MB each)
                </p>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Table className="h-4 w-4" />
                  <span>Bulk sample creation</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckSquare className="h-4 w-4" />
                  <span>Automatic validation</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download Template</span>
            </Button>
          </div>

          {isProcessing && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-blue-800 dark:text-blue-200 font-medium">
                  Processing CSV and creating samples...
                </span>
              </div>
              <Progress value={75} className="mt-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <span>Uploaded Files ({uploadedFiles.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-shrink-0">
                      {getStatusIcon(uploadedFile.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {uploadedFile.file.name}
                        </p>
                        <Badge className={getStatusColor(uploadedFile.status)}>
                          {uploadedFile.status}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>

                        {uploadedFile.processingTime && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{uploadedFile.processingTime}ms</span>
                          </div>
                        )}

                        {uploadedFile.validationResults && (
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 text-xs text-green-600">
                              <CheckSquare className="h-3 w-3" />
                              <span>{uploadedFile.validationResults.filter(r => r.isValid).length}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-red-600">
                              <XSquare className="h-3 w-3" />
                              <span>{uploadedFile.validationResults.filter(r => !r.isValid).length}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {uploadedFile.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {uploadedFile.error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {uploadedFile.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewFile(uploadedFile)}
                        className="flex items-center space-x-1"
                      >
                        <FileText className="h-3 w-3" />
                        <span>View Results</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFile(uploadedFile.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 