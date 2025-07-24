// Types for PDF submission workflow

export interface ExtractedData {
  // Basic sample information
  sampleName?: string
  submitterName?: string
  submitterEmail?: string
  organism?: string
  concentration?: number
  volume?: number
  buffer?: string
  
  // Nanopore-specific fields
  quoteIdentifier?: string
  labName?: string
  phone?: string
  sampleType?: string
  flowCell?: string
  genomeSize?: string
  coverage?: string
  cost?: string
  
  // Additional fields
  piName?: string
  department?: string
  institution?: string
  projectDescription?: string
  dataDelivery?: string
  
  // Processing metadata
  confidence?: number
  extractionMethod?: 'pattern' | 'ai' | 'hybrid'
  issues?: string[]
  rawText?: string
  
  // Sample table data if multiple samples
  sampleTable?: SampleTableEntry[]
}

export interface SampleTableEntry {
  sampleName: string
  volume?: number
  concentration?: number
  qubitConc?: number
  nanodropConc?: number
}

export interface SubmissionData {
  id: string
  submissionDate: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  samples: SampleData[]
  totalSamples: number
  metadata?: Record<string, any>
}

export interface SampleData {
  id?: string
  sampleName: string
  submitterName: string
  submitterEmail: string
  organism?: string
  concentration?: number
  volume?: number
  buffer?: string
  sampleType?: string
  status?: string
  notes?: string
  [key: string]: any // Allow additional fields
}

export interface ProcessingResult {
  success: boolean
  message: string
  extractedData?: ExtractedData
  errors?: string[]
  warnings?: string[]
  processingTime?: number
}