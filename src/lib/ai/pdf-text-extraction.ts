// PDF worker configuration removed for lightweight version
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
    sampleType?: string
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

class PdfTextExtractionService {
  private pdfParseModule: any = null
  private isServerSideInitialized = false
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
   * Initialize PDF parsing modules - simplified to only use pdf-parse
   */
  private async initializePdfParsers(): Promise<{ server: boolean }> {
    const results = { server: false }

    // Only try server-side initialization with pdf-parse
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

    return results
  }

  /**
   * Check if PDF parsing is available
   */
  async isAvailable(): Promise<boolean> {
    const results = await this.initializePdfParsers()
    return results.server
  }

  /**
   * Extract text from PDF using only pdf-parse (server-side)
   */
  async extractText(
    file: File,
    options: PdfExtractionOptions = {}
  ): Promise<PdfExtractionResult> {
    const { onProgress } = options
    
    // Create simple progress tracker
    const tracker = new PdfProgressTracker()
    if (onProgress) {
      tracker.onProgress(onProgress)
    }

    try {
      tracker.start()
      tracker.updateStep(ProcessingStep.INITIALIZING, 0, 'Initializing PDF parser...')
      
      // Initialize PDF parsers
      const { server } = await this.initializePdfParsers()
      
      if (!server) {
        tracker.error('PDF parsing is not available. Please ensure pdf-parse is installed.')
        return {
          success: false,
          error: 'PDF parsing is not available. Please ensure pdf-parse is installed.'
        }
      }

      tracker.updateStep(ProcessingStep.INITIALIZING, 100, 'PDF parser initialized')

      // Only use server-side parsing with pdf-parse
      if (this.isServerSide && this.pdfParseModule) {
        return await this.extractWithPdfParse(file, tracker)
      }

      // If we're on client-side, return error
      tracker.error('PDF parsing is only available on the server in lightweight version')
      return {
        success: false,
        error: 'PDF parsing is only available on the server in lightweight version'
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      tracker.error(`PDF extraction failed: ${errorMessage}`)
      
      return {
        success: false,
        error: `PDF extraction failed: ${errorMessage}`
      }
    }
  }

  /**
   * Extract text using pdf-parse (server-side only)
   */
  private async extractWithPdfParse(
    file: File,
    tracker: PdfProgressTracker
  ): Promise<PdfExtractionResult> {
    return withPdfRetry(async () => {
      tracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 0, 'Extracting text from PDF...')
      
      try {
        // Convert File to Buffer for pdf-parse
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Extract text using pdf-parse
        const result = await this.pdfParseModule(buffer)
        
        tracker.updateStep(ProcessingStep.EXTRACTING_TEXT, 50, 'Text extraction completed')
        tracker.updateStep(ProcessingStep.PATTERN_MATCHING, 0, 'Extracting structured data...')
        
        // Extract structured data using pattern matching
        const extractedFields = pdfPatternMatcher.extractAllFields(result.text)
        
        tracker.updateStep(ProcessingStep.PATTERN_MATCHING, 100, 'Pattern matching completed')
        
        // Build metadata from pdf-parse result
        const metadata = this.buildMetadata(result.info || {})
        
        // Convert pattern matching results to our format
        const sampleName = extractedFields.sampleName?.[0]?.value
        const submitterName = extractedFields.submitterName?.[0]?.value
        const submitterEmail = extractedFields.submitterEmail?.[0]?.value
        const labName = extractedFields.labName?.[0]?.value
        const projectName = extractedFields.projectName?.[0]?.value
        const sequencingType = extractedFields.sequencingType?.[0]?.value
        const sampleType = extractedFields.sampleType?.[0]?.value
        const libraryType = extractedFields.libraryType?.[0]?.value
        const flowCellType = extractedFields.flowCellType?.[0]?.value
        const priority = extractedFields.priority?.[0]?.value
        
        // Calculate confidence
        const totalFields = 10
        const extractedCount = [sampleName, submitterName, submitterEmail, labName, projectName, 
                               sequencingType, sampleType, libraryType, flowCellType, priority]
                               .filter(Boolean).length
        const confidence = extractedCount / totalFields
        
        const extractedData: ExtractedPdfData = {
          rawText: result.text,
          pageCount: result.numpages || 1,
          metadata,
          extractedFields: {
            sampleName,
            submitterName,
            submitterEmail,
            labName,
            projectName,
            sequencingType,
            sampleType,
            libraryType,
            flowCellType,
            priority,
            confidence
          }
        }

        tracker.complete('PDF processing completed successfully')
        
        return {
          success: true,
          data: extractedData
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        tracker.error(`PDF extraction failed: ${errorMessage}`)
        
        throw createPdfError(
          PdfErrorType.PARSER_ERROR,
          `pdf-parse extraction failed: ${errorMessage}`,
          { fileName: file.name, fileSize: file.size }
        )
      }
    })
  }
}

// Export singleton instance
export const pdfTextService = new PdfTextExtractionService()
