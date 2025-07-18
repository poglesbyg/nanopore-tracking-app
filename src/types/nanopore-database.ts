// Database types for Nanopore Submission and Sample tracking

export interface NanoporeSubmission {
  id: string
  
  // Submission metadata
  submissionNumber: string // e.g., "HTSF-JL-147"
  submissionDate: Date
  pdfFilename?: string
  pdfPath?: string
  
  // Submitter information
  submitterName: string
  submitterEmail: string
  submitterPhone?: string
  
  // Organization information
  organizationName?: string
  department?: string
  labName?: string
  piName?: string // Principal Investigator
  
  // Project information
  projectId?: string // Service Project ID from iLab
  projectName?: string
  grantNumber?: string
  poNumber?: string // Purchase Order
  
  // Billing information
  billingContactName?: string
  billingContactEmail?: string
  billingAddress?: string
  accountNumber?: string
  
  // Quote information
  quoteNumber?: string
  quoteDate?: Date
  quoteAmount?: number
  quoteValidUntil?: Date
  
  // Service details
  serviceType?: string // "Nanopore Sequencing", "Library Prep + Sequencing", etc.
  turnaroundTime?: string // "Standard (2-3 weeks)", "Rush (1 week)", etc.
  priority: 'low' | 'normal' | 'high' | 'urgent'
  
  // Special requirements
  specialInstructions?: string
  hazardousMaterials: boolean
  hazardDetails?: string
  
  // Data delivery preferences
  dataDeliveryMethod?: 'download' | 'cloud' | 'hard drive'
  cloudStoragePath?: string
  notificationPreferences?: {
    email?: boolean
    sms?: boolean
  }
  
  // Status tracking
  status: 'draft' | 'submitted' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
  acceptedAt?: Date
  completedAt?: Date
  
  // Administrative fields
  createdBy?: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
  
  // Relations
  samples?: NanoporeSample[]
}

export interface NanoporeSample {
  id: string
  submissionId: string
  
  // Sample identification
  sampleName: string
  sampleNumber: number // Order within submission (1, 2, 3...)
  internalId?: string // Lab's internal tracking ID
  externalId?: string // Customer's ID
  
  // Sample type and source
  sampleType: string // "Genomic DNA", "Total RNA", "PCR Product", etc.
  organism?: string
  tissueType?: string
  cellType?: string
  growthConditions?: string
  
  // Sample preparation details
  extractionMethod?: string
  extractionDate?: Date
  extractionKit?: string
  
  // Sample quality metrics
  concentration?: number // ng/μL
  concentrationMethod?: string // "Qubit", "NanoDrop", "Bioanalyzer"
  volume?: number // μL
  totalAmount?: number // ng (calculated)
  
  // Purity measurements
  a260_280?: number // Purity ratio
  a260_230?: number // Purity ratio
  rinScore?: number // RNA Integrity Number (for RNA samples)
  dnaIntegrityNumber?: number // DIN (for DNA samples)
  
  // Fragment size information
  fragmentSizeMin?: number // bp
  fragmentSizeMax?: number // bp
  fragmentSizeAvg?: number // bp
  fragmentSizeDistribution?: string // Description or file reference
  
  // Library preparation requirements
  libraryPrepMethod?: string // "Ligation", "Rapid", "PCR-free", "cDNA"
  libraryPrepKit?: string // "SQK-LSK114", "SQK-RBK114", etc.
  barcodingRequired: boolean
  barcodeKit?: string // "EXP-NBD114", etc.
  barcodeNumber?: string // "BC01", "BC02", etc.
  
  // Sequencing parameters
  flowCellType?: string // "R9.4.1", "R10.4.1", "R10.3"
  flowCellCount: number
  sequencingChemistry?: string // "Kit 14", "Kit 12"
  
  // Expected outputs
  expectedYieldGb?: number // Expected data in GB
  expectedReadLength?: string // "Standard (5-30kb)", "Long (>30kb)", "Ultra-long (>100kb)"
  expectedReadN50?: number // Expected N50 in bp
  targetCoverage?: number // Target coverage depth (e.g., 30x)
  
  // Reference genome information
  referenceGenome?: string // "hg38", "mm10", custom reference
  referenceGenomeUrl?: string // Link to custom reference
  genomeSizeMb?: number // Genome size in Mb
  
  // Basecalling preferences
  basecallingModel?: string // "super-accurate", "fast", "hac"
  basecallingConfig?: string // Specific Guppy/Dorado config
  modificationsCalling: boolean // Detect base modifications
  
  // Analysis requirements
  analysisRequired: boolean
  demultiplexingRequired: boolean
  adapterTrimming: boolean
  qualityFiltering: boolean
  
  // Specific analyses requested
  genomeAssembly: boolean
  variantCalling: boolean
  structuralVariantDetection: boolean
  methylationCalling: boolean
  transcriptomeAnalysis: boolean
  metagenomicsAnalysis: boolean
  
  // Custom analysis parameters
  customAnalysisParams?: Record<string, any>
  
  // Data output preferences
  outputFormat?: string[] // Array: ["FASTQ", "FAST5", "POD5", "BAM"]
  compressionRequired: boolean
  
  // Quality control
  qcStatus: 'pending' | 'passed' | 'failed' | 'conditional'
  qcNotes?: string
  qcMetrics?: Record<string, any> // Detailed QC metrics
  
  // Processing status
  status: 'submitted' | 'received' | 'qc' | 'library_prep' | 'sequencing' | 'analysis' | 'completed' | 'failed' | 'cancelled'
  libraryPrepStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  sequencingStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  analysisStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'not_required'
  
  // Assignment and tracking
  assignedTo?: string
  libraryPrepBy?: string
  sequencingBy?: string
  analysisBy?: string
  
  // Important dates
  receivedDate?: Date
  libraryPrepDate?: Date
  sequencingStartDate?: Date
  sequencingEndDate?: Date
  analysisCompleteDate?: Date
  dataDeliveredDate?: Date
  
  // Results and metrics
  actualYieldGb?: number
  actualReadN50?: number
  actualReadCount?: number
  actualCoverage?: number
  passReadsPercentage?: number
  
  // File paths
  rawDataPath?: string
  processedDataPath?: string
  analysisResultsPath?: string
  reportPath?: string
  
  // Notes and communication
  internalNotes?: string
  customerNotes?: string
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  
  // Relations
  submission?: NanoporeSubmission
  workflowSteps?: NanoporeWorkflowStep[]
  attachments?: NanoporeAttachment[]
}

export interface NanoporeWorkflowStep {
  id: string
  sampleId: string
  
  stepNumber: number
  stepName: string
  stepCategory?: 'QC' | 'Library Prep' | 'Sequencing' | 'Analysis'
  
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  startedAt?: Date
  completedAt?: Date
  durationHours?: number
  
  performedBy?: string
  
  // Step-specific data
  inputMetrics?: Record<string, any>
  outputMetrics?: Record<string, any>
  parametersUsed?: Record<string, any>
  
  notes?: string
  issuesEncountered?: string
  
  createdAt: Date
  updatedAt: Date
  
  // Relations
  sample?: NanoporeSample
}

export interface NanoporeAttachment {
  id: string
  
  // Can be attached to either submission or sample
  submissionId?: string
  sampleId?: string
  
  fileName: string
  fileType?: string
  fileSizeBytes?: number
  filePath?: string
  
  attachmentType?: 'submission_form' | 'qc_report' | 'bioanalyzer' | 'gel_image' | 'other'
  description?: string
  
  uploadedBy?: string
  uploadedAt: Date
  
  createdAt: Date
  
  // Relations
  submission?: NanoporeSubmission
  sample?: NanoporeSample
}

export interface NanoporeCommunication {
  id: string
  
  submissionId?: string
  sampleId?: string
  
  communicationType?: 'email' | 'phone' | 'note' | 'status_update'
  direction?: 'incoming' | 'outgoing' | 'internal'
  
  subject?: string
  content: string
  
  fromUser?: string
  toUser?: string
  
  attachments?: string[] // Array of attachment IDs
  
  createdBy?: string
  createdAt: Date
  
  // Relations
  submission?: NanoporeSubmission
  sample?: NanoporeSample
}

// Form data types for creating/updating submissions and samples
export interface CreateSubmissionInput {
  submissionNumber: string
  submitterName: string
  submitterEmail: string
  submitterPhone?: string
  organizationName?: string
  department?: string
  labName?: string
  piName?: string
  projectId?: string
  projectName?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  specialInstructions?: string
  dataDeliveryMethod?: 'download' | 'cloud' | 'hard drive'
  samples: CreateSampleInput[]
}

export interface CreateSampleInput {
  sampleName: string
  sampleNumber: number
  sampleType: string
  organism?: string
  concentration?: number
  volume?: number
  a260_280?: number
  a260_230?: number
  libraryPrepMethod?: string
  flowCellType?: string
  expectedYieldGb?: number
  referenceGenome?: string
  analysisRequired?: boolean
  specialRequirements?: string
}

// Status update types
export interface UpdateSubmissionStatus {
  submissionId: string
  status: NanoporeSubmission['status']
  notes?: string
}

export interface UpdateSampleStatus {
  sampleId: string
  status: NanoporeSample['status']
  qcStatus?: NanoporeSample['qcStatus']
  qcNotes?: string
  assignedTo?: string
}

// Workflow step update
export interface CreateWorkflowStep {
  sampleId: string
  stepNumber: number
  stepName: string
  stepCategory?: NanoporeWorkflowStep['stepCategory']
  performedBy?: string
  notes?: string
}

export interface UpdateWorkflowStep {
  stepId: string
  status: NanoporeWorkflowStep['status']
  completedAt?: Date
  outputMetrics?: Record<string, any>
  notes?: string
  issuesEncountered?: string
} 