import { configurePdfWorker } from '../pdf-worker-config'
import { withPdfRetry, createPdfError, PdfErrorType } from '../pdf-error-handler'
import { pdfPatternMatcher } from '../pdf-pattern-matcher'
import { 
  PdfProgressTracker, 
  ProcessingStep, 
  DEFAULT_PROCESSING_STEPS,
  PATTERN_ONLY_STEPS,
  type ProgressCallback 
} from '../pdf-progress-tracker'

export interface ExtractedPdfData {
  rawText: string
  pageCount: number
  metadata: {
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
  }
  extractedFields?: {
    sampleName?: string
    submitterName?: string
    submitterEmail?: string
    labName?: string
    projectName?: string
    sequencingType?: string
    libraryType?: string
    flowCellType?: string
    priority?: string
    confidence: number
  }
}

export interface PdfExtractionResult {
  success: boolean
  data?: ExtractedPdfData
  error?: string
}

export interface PdfExtractionOptions {
  onProgress?: ProgressCallback
  useAI?: boolean
  useRAG?: boolean
}

// PDF.js types for client-side parsing
interface PdfJsDocument {
  numPages: number
  getPage(pageNumber: number): Promise<PdfJsPage>
  getMetadata(): Promise<{ info: any; metadata: any }>
  destroy(): void
}

interface PdfJsPage {
  getTextContent(): Promise<{ items: Array<{ str: string }> }>
}

class PdfTextExtractionService {
  private pdfParseModule: any = null
  private pdfjsModule: any = null
  private isServerSideInitialized = false
  private isClientSideInitialized = false
  private initializationError: string | null = null
  private isServerSide = typeof window === 'undefined'

  /**
   * Helper function to build metadata object with proper typing
   */
  private buildMetadata(info: any): ExtractedPdfData['metadata'] {
    const metadata: ExtractedPdfData['metadata'] = {}
    
    if (info?.Title) metadata.title = info.Title
    if (info?.Author) metadata.author = info.Author
    if (info?.Subject) metadata.subject = info.Subject
    if (info?.Creator) metadata.creator = info.Creator
    if (info?.Producer) metadata.producer = info.Producer
    if (info?.CreationDate) metadata.creationDate = new Date(info.CreationDate)
    if (info?.ModDate) metadata.modificationDate = new Date(info.ModDate)
    
    return metadata
  }

  /**
   * Initialize PDF parsing modules with fallback support
   */
  private async initializePdfParsers(): Promise<{ server: boolean; client: boolean }> {
    const results = { server: false, client: false }

          // Try server-side initialization first
      if (this.isServerSide && !this.isServerSideInitialized) {
        try {
          // @ts-ignore - pdf-parse doesn't have types
          const pdfModule = await import('pdf-parse')
          this.pdfParseModule = pdfModule.default || pdfModule
          this.isServerSideInitialized = true
          results.server = true
        } catch (error) {
          console.warn('Server-side PDF parsing not available:', error)
        }
      }

          // Try client-side initialization
      if (!this.isClientSideInitialized) {
        try {
          // Use pdfjs-dist for client-side text extraction
          const pdfjsModule = await import('pdfjs-dist')
          
          // Configure worker using the centralized configuration
          if (typeof window !== 'undefined') {
            try {
              await configurePdfWorker(pdfjsModule, pdfjsModule.version)
            } catch (workerError) {
              console.warn('Worker configuration failed, using fallback:', workerError)
              // Fallback to basic configuration
              pdfjsModule.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsModule.version}/build/pdf.worker.min.js`
            }
          }
          
          this.pdfjsModule = pdfjsModule
          this.isClientSideInitialized = true
          results.client = true
        } catch (error) {
          console.warn('Client-side PDF parsing not available:', error)
        }
      }

    return results
  }

  /**
   * Extract text using server-side pdf-parse
   */
  private async extractTextServerSide(file: File): Promise<PdfExtractionResult> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const pdfData = await this.pdfParseModule(buffer)

              const extractedData: ExtractedPdfData = {
          rawText: pdfData.text || '',
          pageCount: pdfData.numpages || 0,
          metadata: this.buildMetadata(pdfData.info),
        }

      return {
        success: true,
        data: extractedData,
      }
    } catch (error) {
      console.error('Server-side PDF extraction failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Server-side PDF extraction failed',
      }
    }
  }

  /**
   * Extract text using client-side PDF.js
   */
  private async extractTextClientSide(file: File): Promise<PdfExtractionResult> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = this.pdfjsModule.getDocument({ data: arrayBuffer })
      const pdfDocument: PdfJsDocument = await loadingTask.promise

      let fullText = ''
      const numPages = pdfDocument.numPages

      // Extract text from all pages
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        const page = await pdfDocument.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n'
      }

      // Get metadata
      const metadata = await pdfDocument.getMetadata()
      
              const extractedData: ExtractedPdfData = {
          rawText: fullText.trim(),
          pageCount: numPages,
          metadata: this.buildMetadata(metadata.info),
        }

      // Clean up
      pdfDocument.destroy()

      return {
        success: true,
        data: extractedData,
      }
    } catch (error) {
      console.error('Client-side PDF extraction failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Client-side PDF extraction failed',
      }
    }
  }

  /**
   * Extract text and metadata from a PDF file with fallback support
   */
  async extractText(file: File, options: PdfExtractionOptions = {}): Promise<PdfExtractionResult> {
    const context = {
      fileName: file.name,
      fileSize: file.size,
      processingStep: 'text_extraction'
    }

    // Determine processing steps based on options
    const steps = options.useAI || options.useRAG ? DEFAULT_PROCESSING_STEPS : PATTERN_ONLY_STEPS
    const progressTracker = new PdfProgressTracker(steps)
    
    if (options.onProgress) {
      progressTracker.onProgress(options.onProgress)
    }

    try {
      // Start progress tracking
      progressTracker.start()

      // Step 1: Validate file
      progressTracker.updateStep(ProcessingStep.VALIDATING_FILE, 0, 'Validating PDF file...')
      
      if (!file || file.type !== 'application/pdf') {
        const error = createPdfError(
          PdfErrorType.FILE_INVALID,
          new Error('Invalid file type'),
          context
        )
        progressTracker.error(error.userMessage)
        return {
          success: false,
          error: error.userMessage,
        }
      }

      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        const error = createPdfError(
          PdfErrorType.FILE_TOO_LARGE,
          new Error('File too large'),
          context
        )
        progressTracker.error(error.userMessage)
        return {
          success: false,
          error: error.userMessage,
        }
      }

      progressTracker.updateStep(ProcessingStep.VALIDATING_FILE, 100, 'File validation completed')

      // Step 2: Load parser
      progressTracker.updateStep(ProcessingStep.LOADING_PARSER, 0, 'Loading PDF parser...')
      
      // Extract text with retry logic
      return await withPdfRetry(async () => {
        // Initialize parsers
        const { server, client } = await this.initializePdfParsers()

        if (!server && !client) {
          const error = createPdfError(
            PdfErrorType.WORKER_FAILED,
            new Error('No PDF parsing modules available'),
            context
          )
          progressTracker.error(error.userMessage)
          throw error
        }

        progressTracker.updateStep(ProcessingStep.LOADING_PARSER, 100, 'PDF parser loaded successfully')

        // Step 3: Extract text
        progressTracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 0, 'Extracting text from PDF...')
        
        let extractResult: PdfExtractionResult

        // Try server-side first, then client-side
        if (server && this.pdfParseModule) {
          try {
            progressTracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 50, 'Using server-side extraction...')
            extractResult = await this.extractTextServerSide(file)
            if (extractResult.success) {
              progressTracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 100, 'Text extraction completed')
            } else {
              throw new Error(extractResult.error || 'Server-side extraction failed')
            }
          } catch (serverError) {
            console.warn('Server-side extraction failed, trying client-side...', serverError)
            progressTracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 50, 'Trying client-side extraction...')
          }
        }

        if (client && this.pdfjsModule && !extractResult!.success) {
          extractResult = await this.extractTextClientSide(file)
          if (extractResult.success) {
            progressTracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 100, 'Text extraction completed')
          } else {
            throw new Error(extractResult.error || 'Client-side extraction failed')
          }
        }

        if (!extractResult! || !extractResult!.success) {
          const error = createPdfError(
            PdfErrorType.EXTRACTION_FAILED,
            new Error('PDF extraction failed with all available methods'),
            context
          )
          progressTracker.error(error.userMessage)
          throw error
        }

        // Step 4: Extract metadata
        progressTracker.updateStep(ProcessingStep.EXTRACTING_METADATA, 0, 'Processing metadata...')
        // Metadata is already extracted in the extraction process
        progressTracker.updateStep(ProcessingStep.EXTRACTING_METADATA, 100, 'Metadata extraction completed')

        // Step 5: Finalize
        progressTracker.updateStep(ProcessingStep.FINALIZING, 0, 'Finalizing results...')
        progressTracker.updateStep(ProcessingStep.FINALIZING, 100, 'Processing finalized')
        
        progressTracker.complete('PDF text extraction completed successfully')
        
        return extractResult
      }, context)
    } catch (error: any) {
      console.error('PDF text extraction failed:', error)
      
      // If it's already a PdfError, use its user message
      if (error.userMessage) {
        progressTracker.error(error.userMessage)
        return {
          success: false,
          error: error.userMessage,
        }
      }
      
      // Otherwise, create a new error
      const pdfError = createPdfError(
        PdfErrorType.UNKNOWN_ERROR,
        error,
        context
      )
      
      progressTracker.error(pdfError.userMessage)
      
      return {
        success: false,
        error: pdfError.userMessage,
      }
    }
  }

  /**
   * Extract structured data from PDF text using advanced pattern matching
   * This provides a fallback when LLM is not available
   */
  extractStructuredData(
    rawText: string,
  ): Partial<ExtractedPdfData['extractedFields']> {
    const fields: Partial<ExtractedPdfData['extractedFields']> = {}

    try {
      // Use advanced pattern matcher for more accurate extraction
      const extractedFields = pdfPatternMatcher.extractAllFields(rawText)
      
      // Map the pattern matches to our field structure
      const sampleName = extractedFields.sampleName?.[0]?.value
      if (sampleName) {
        fields.sampleName = sampleName
      }
      
      const submitterName = extractedFields.submitterName?.[0]?.value
      if (submitterName) {
        fields.submitterName = submitterName
      }
      
      const submitterEmail = extractedFields.submitterEmail?.[0]?.value
      if (submitterEmail) {
        fields.submitterEmail = submitterEmail
      }
      
      const labName = extractedFields.labName?.[0]?.value
      if (labName) {
        fields.labName = labName
      }
      
      const projectName = extractedFields.projectName?.[0]?.value
      if (projectName) {
        fields.projectName = projectName
      }
      
      const sequencingType = extractedFields.sequencingType?.[0]?.value
      if (sequencingType) {
        fields.sequencingType = sequencingType
      }
      
      const libraryType = extractedFields.libraryType?.[0]?.value
      if (libraryType) {
        fields.libraryType = libraryType
      }
      
      const flowCellType = extractedFields.flowCellType?.[0]?.value
      if (flowCellType) {
        fields.flowCellType = flowCellType
      }
      
      const priority = extractedFields.priority?.[0]?.value
      if (priority) {
        fields.priority = priority
      }

      // Calculate confidence based on pattern matching scores
      const totalFields = 9
      const extractedCount = Object.keys(fields).length
      
      // Calculate weighted confidence based on pattern matching confidence scores
      let totalConfidence = 0
      let confidenceCount = 0
      
             Object.values(extractedFields).forEach(matches => {
         if (matches && matches.length > 0) {
           totalConfidence += matches[0]?.confidence ?? 0
           confidenceCount++
         }
       })
      
      const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0
      const completeness = extractedCount / totalFields
      
      // Combine pattern confidence with field completeness
      fields.confidence = Math.min(avgConfidence * 0.7 + completeness * 0.3, 0.9)

      return fields
    } catch (error) {
      console.error('Structured data extraction failed:', error)
      return { confidence: 0 }
    }
  }

  /**
   * Enhanced validation for extracted data
   */
  validateExtractedData(
    fields: Partial<ExtractedPdfData['extractedFields']> | undefined,
  ): {
    isValid: boolean
    issues: string[]
    confidence: number
  } {
    const issues: string[] = []
    let confidence = fields?.confidence || 0

    // Enhanced email validation
    if (fields?.submitterEmail) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(fields.submitterEmail)) {
        issues.push('Invalid email format')
        confidence *= 0.8
      }
    }

    // Enhanced sample name validation
    if (fields?.sampleName) {
      if (fields.sampleName.length < 2) {
        issues.push('Sample name too short')
        confidence *= 0.9
      } else if (fields.sampleName.length > 100) {
        issues.push('Sample name too long')
        confidence *= 0.9
      } else if (!/^[A-Za-z0-9_.\-]+$/.test(fields.sampleName)) {
        issues.push('Sample name contains invalid characters')
        confidence *= 0.9
      }
    }

    // Enhanced submitter name validation
    if (fields?.submitterName) {
      if (fields.submitterName.length < 2) {
        issues.push('Submitter name too short')
        confidence *= 0.9
      } else if (fields.submitterName.length > 100) {
        issues.push('Submitter name too long')
        confidence *= 0.9
      } else if (!/^[A-Za-z\s,.-]+$/.test(fields.submitterName)) {
        issues.push('Submitter name contains invalid characters')
        confidence *= 0.9
      }
    }

    // Priority validation
    if (fields?.priority) {
      const validPriorities = ['high', 'medium', 'low', 'standard', 'rush', 'urgent', 'normal']
      if (!validPriorities.includes(fields.priority.toLowerCase())) {
        issues.push('Invalid priority level')
        confidence *= 0.9
      }
    }

    // Sequencing type validation
    if (fields?.sequencingType) {
      const validTypes = ['DNA', 'RNA', 'cDNA', 'genomic', 'transcriptomic', 'metagenomic']
      if (!validTypes.some(type => fields.sequencingType?.toLowerCase().includes(type.toLowerCase()))) {
        issues.push('Unrecognized sequencing type')
        confidence *= 0.9
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      confidence: Math.max(confidence, 0.1), // Minimum confidence
    }
  }

  /**
   * Check if PDF parsing is available
   */
  async isAvailable(): Promise<boolean> {
    const { server, client } = await this.initializePdfParsers()
    return server || client
  }

  /**
   * Get information about available parsing methods
   */
  async getAvailableMethods(): Promise<{
    serverSide: boolean
    clientSide: boolean
    preferredMethod: 'server' | 'client' | 'none'
  }> {
    const { server, client } = await this.initializePdfParsers()
    
    return {
      serverSide: server,
      clientSide: client,
      preferredMethod: server ? 'server' : client ? 'client' : 'none'
    }
  }
}

export const pdfTextService = new PdfTextExtractionService()
