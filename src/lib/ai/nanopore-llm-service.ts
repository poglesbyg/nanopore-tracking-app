import { aiService } from './ollama-service'
// Dynamic import to avoid pdf-parse initialization issues
import { ragService } from './rag-system'
import type { RAGResult } from './rag-system'

export interface NanoporeFormData {
  // Basic Information
  sampleName?: string | undefined
  submitterName?: string | undefined
  submitterEmail?: string | undefined
  labName?: string | undefined
  projectName?: string | undefined

  // Sequencing Details
  sequencingType?: string | undefined // DNA, RNA, cDNA
  sampleType?: string | undefined // Genomic DNA, Total RNA, etc.
  libraryType?: string | undefined // Ligation, Rapid, PCR-free, etc.
  flowCellType?: string | undefined // MinION, GridION, PromethION, etc.

  // Sample Metrics
  concentration?: string | undefined
  volume?: string | undefined
  purity?: string | undefined
  fragmentSize?: string | undefined

  // Processing Options
  priority?: string | undefined // Standard, High, Rush, Urgent
  basecalling?: string | undefined // Standard, High Accuracy, Fast
  demultiplexing?: boolean | undefined

  // Bioinformatics
  referenceGenome?: string | undefined
  analysisType?: string | undefined
  dataDelivery?: string | undefined // Raw, Processed, FASTQ, etc.

  // Metadata
  extractionMethod: string // 'llm', 'pattern', 'hybrid', 'rag'
  confidence: number
  issues?: string[] | undefined
  processingTime?: number | undefined
  ragInsights?: RAGResult | undefined
  ragRecommendations?: string[] | undefined
}

export interface NanoporeExtractionResult {
  success: boolean
  data?: NanoporeFormData
  error?: string
  rawText?: string
  processingTime?: number
}

class NanoporeFormExtractionService {
  /**
   * Extract and map form data from PDF using LLM + pattern matching + RAG
   */
  async extractFormData(file: File): Promise<NanoporeExtractionResult> {
    const startTime = Date.now()

    try {
      // Step 1: Check if PDF parsing is available (dynamic import)
      const { pdfTextService } = await import('./pdf-text-extraction')
      const isPdfAvailable = await pdfTextService.isAvailable()
      if (!isPdfAvailable) {
        return {
          success: false,
          error:
            'PDF parsing is not available. Please check that the pdf-parse library is properly installed.',
          processingTime: Date.now() - startTime,
        }
      }

      // Step 2: Extract text from PDF
      const textResult = await pdfTextService.extractText(file)

      if (!textResult.success || !textResult.data) {
        return {
          success: false,
          error: textResult.error || 'Failed to extract text from PDF',
          processingTime: Date.now() - startTime,
        }
      }

      const { rawText } = textResult.data
      let formData: NanoporeFormData | null = null
      let extractionMethod: 'llm' | 'pattern' | 'hybrid' | 'rag' = 'pattern'

      // Step 3: Try LLM extraction first if available
      if (await aiService.isAvailable()) {
        try {
          const llmResult = await this.extractWithLLM(rawText)
          if (llmResult) {
            formData = llmResult
            extractionMethod = 'llm'
          }
        } catch (error) {
          console.warn(
            'LLM extraction failed, falling back to pattern matching:',
            error,
          )
        }
      }

      // Step 4: Fallback to pattern matching or enhance LLM results
      if (!formData) {
        const patternResult = await this.extractWithPatterns(rawText)
        formData = patternResult
        extractionMethod = 'pattern'
      } else {
        // Hybrid approach: enhance LLM results with pattern matching
        const patternResult = await this.extractWithPatterns(rawText)
        formData = this.mergeExtractionResults(formData, patternResult)
        extractionMethod = 'hybrid'
      }

      // Step 5: Enhance with RAG system if available
      let ragInsights: RAGResult | undefined
      let ragRecommendations: string[] = []

      try {
        const isRagAvailable = await ragService.isAvailable()
        if (isRagAvailable && formData) {
          const ragResult = await ragService.enhanceExtraction(formData)

          // Use RAG-enhanced data if it has better confidence
          if (ragResult.ragInsights.overallConfidence > formData.confidence) {
            formData = {
              ...formData,
              ...ragResult.enhancedData,
              extractionMethod: 'rag',
              confidence: Math.max(
                formData.confidence,
                ragResult.ragInsights.overallConfidence,
              ),
              ragInsights: ragResult.ragInsights,
              ragRecommendations: ragResult.recommendations,
            }
            extractionMethod = 'rag'
          } else {
            // Still include RAG insights even if not using enhanced data
            formData.ragInsights = ragResult.ragInsights
            formData.ragRecommendations = ragResult.recommendations
          }

          ragInsights = ragResult.ragInsights
          ragRecommendations = ragResult.recommendations
        }
      } catch (error) {
        console.warn('RAG enhancement failed:', error)
        // Continue without RAG enhancement
      }

      // Step 6: Final validation and confidence calculation
      const processingTime = Date.now() - startTime
      
      // Ensure formData is not null (should never happen due to fallback)
      if (!formData) {
        throw new Error('Failed to extract any data from PDF')
      }
      
      const validationIssues = this.validateExtractedData(formData)

      // Adjust confidence based on validation issues
      let finalConfidence = formData.confidence
      if (validationIssues.length > 0) {
        finalConfidence = Math.max(
          0.3,
          finalConfidence - validationIssues.length * 0.1,
        )
      }

      // Add RAG insights to issues if available
      if (ragInsights?.validationIssues) {
        validationIssues.push(...ragInsights.validationIssues)
      }

      const finalData: NanoporeFormData = {
        ...formData,
        extractionMethod,
        confidence: finalConfidence,
        issues: validationIssues,
        processingTime,
        ragInsights,
        ragRecommendations,
      }

      return {
        success: true,
        data: finalData,
        processingTime,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - startTime,
      }
    }
  }

  /**
   * Extract form data using LLM with specialized prompts
   */
  private async extractWithLLM(
    rawText: string,
  ): Promise<NanoporeFormData | null> {
    const prompt = `
You are an expert at extracting information from Oxford Nanopore sequencing submission forms.
Analyze the following PDF text and extract the relevant form fields.

PDF Text:
${rawText}

Please extract the following information and return it as a JSON object:

{
  "sampleName": "string - sample identifier",
  "submitterName": "string - person submitting the sample",
  "submitterEmail": "string - contact email",
  "labName": "string - laboratory or department name",
  "projectName": "string - project or study name",
  "sequencingType": "DNA|RNA|cDNA|Other - type of sequencing",
  "sampleType": "Genomic DNA|Plasmid|PCR Product|Other - sample type",
  "libraryType": "Ligation|Rapid|PCR-free|Other - library preparation method",
  "flowCellType": "MinION|GridION|PromethION|Flongle|Other - flow cell type",
  "concentration": "string - sample concentration with units",
  "volume": "string - sample volume with units",
  "purity": "string - purity measurements (A260/A280, etc.)",
  "fragmentSize": "string - fragment size information",
  "priority": "Standard|High|Rush - processing priority",
  "basecalling": "Standard|High Accuracy|Fast - basecalling method",
  "demultiplexing": "boolean - whether demultiplexing is needed",
  "referenceGenome": "string - reference genome if specified",
  "analysisType": "string - type of analysis requested",
  "dataDelivery": "Raw|Processed|Both - data delivery preference"
}

Rules:
1. Only extract information that is clearly present in the text
2. Use null for fields that cannot be determined
3. Normalize values to the specified options where possible
4. Be conservative - if unsure, use null
5. Return valid JSON only

JSON Response:
`

    try {
      const response = await (aiService as any).answerQuestion(prompt)

      // Parse the LLM response
      const jsonMatch = response.match(/{[\S\s]*}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response')
      }

      const extractedData = JSON.parse(jsonMatch[0])

      // Convert to our form data structure
      const formData: NanoporeFormData = {
        sampleName: extractedData.sampleName || undefined,
        submitterName: extractedData.submitterName || undefined,
        submitterEmail: extractedData.submitterEmail || undefined,
        labName: extractedData.labName || undefined,
        projectName: extractedData.projectName || undefined,
        sequencingType: extractedData.sequencingType || undefined,
        sampleType: extractedData.sampleType || undefined,
        libraryType: extractedData.libraryType || undefined,
        flowCellType: extractedData.flowCellType || undefined,
        concentration: extractedData.concentration || undefined,
        volume: extractedData.volume || undefined,
        purity: extractedData.purity || undefined,
        fragmentSize: extractedData.fragmentSize || undefined,
        priority: extractedData.priority || undefined,
        basecalling: extractedData.basecalling || undefined,
        demultiplexing: extractedData.demultiplexing || false,
        referenceGenome: extractedData.referenceGenome || undefined,
        analysisType: extractedData.analysisType || undefined,
        dataDelivery: extractedData.dataDelivery || undefined,
        confidence: 0.9, // High confidence for LLM extraction
        extractionMethod: 'llm',
        issues: [],
      }

      return formData
    } catch (error) {
      console.error('LLM extraction failed:', error)
      return null
    }
  }

  /**
   * Extract form data using pattern matching (fallback)
   */
  private async extractWithPatterns(rawText: string): Promise<NanoporeFormData> {
    // Use the existing pattern matching from pdf-text-extraction (dynamic import)
    const { pdfTextService } = await import('./pdf-text-extraction')
    const basicFields = pdfTextService.extractStructuredData(rawText) || {}

    // Add Nanopore-specific fields
    const nanoporeFields = this.extractNanoporeSpecificFields(rawText)

    return {
      sampleName: basicFields.sampleName || nanoporeFields.sampleName || undefined,
      submitterName: basicFields.submitterName || nanoporeFields.submitterName || undefined,
      submitterEmail:
        basicFields.submitterEmail || nanoporeFields.submitterEmail || undefined,
      labName: basicFields.labName || nanoporeFields.labName || undefined,
      projectName: basicFields.projectName || nanoporeFields.projectName || undefined,
      sequencingType: nanoporeFields.sequencingType || undefined,
      sampleType: nanoporeFields.sampleType || undefined,
      libraryType: nanoporeFields.libraryType || undefined,
      flowCellType: nanoporeFields.flowCellType || undefined,
      concentration: nanoporeFields.concentration || undefined,
      volume: nanoporeFields.volume || undefined,
      purity: nanoporeFields.purity || undefined,
      fragmentSize: nanoporeFields.fragmentSize || undefined,
      priority: (basicFields.priority as any) || nanoporeFields.priority || undefined,
      basecalling: nanoporeFields.basecalling || undefined,
      demultiplexing: nanoporeFields.demultiplexing || false,
      referenceGenome: nanoporeFields.referenceGenome || undefined,
      analysisType: nanoporeFields.analysisType || undefined,
      dataDelivery: nanoporeFields.dataDelivery || undefined,
      confidence: basicFields.confidence || 0.6,
      extractionMethod: 'pattern',
      issues: [],
    }
  }

  /**
   * Extract Nanopore-specific fields using targeted patterns
   */
  private extractNanoporeSpecificFields(
    rawText: string,
  ): Partial<NanoporeFormData> {
    const fields: Partial<NanoporeFormData> = {}

    // Concentration patterns
    const concentrationPatterns = [
      /concentration:?\s*([\d.]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm))/i,
      /conc\.?:?\s*([\d.]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm))/i,
    ]

    // Volume patterns
    const volumePatterns = [
      /volume:?\s*([\d.]+\s*(?:μl|ul|ml|l))/i,
      /vol\.?:?\s*([\d.]+\s*(?:μl|ul|ml|l))/i,
    ]

    // Purity patterns
    const purityPatterns = [
      /a260\/a280:?\s*([\d.]+)/i,
      /260\/280:?\s*([\d.]+)/i,
      /purity:?\s*([\d.]+)/i,
    ]

    // Fragment size patterns
    const fragmentPatterns = [
      /fragment\s*size:?\s*([\d.]+\s*(?:bp|kb|mb))/i,
      /size:?\s*([\d.]+\s*(?:bp|kb|mb))/i,
    ]

    // Flow cell patterns
    const flowCellPatterns = [
      /flow\s*cell:?\s*(minion|gridion|promethion|flongle)/i,
      /platform:?\s*(minion|gridion|promethion|flongle)/i,
    ]

    // Basecalling patterns
    const basecallingPatterns = [
      /basecalling:?\s*(standard|high\s*accuracy|fast)/i,
      /base\s*calling:?\s*(standard|high\s*accuracy|fast)/i,
    ]

    // Extract fields
    for (const pattern of concentrationPatterns) {
      const match = rawText.match(pattern)
      if (match && match[1]) {
        fields.concentration = match[1].trim()
        break
      }
    }

    for (const pattern of volumePatterns) {
      const match = rawText.match(pattern)
      if (match && match[1]) {
        fields.volume = match[1].trim()
        break
      }
    }

    for (const pattern of purityPatterns) {
      const match = rawText.match(pattern)
      if (match && match[1]) {
        fields.purity = match[1].trim()
        break
      }
    }

    for (const pattern of fragmentPatterns) {
      const match = rawText.match(pattern)
      if (match && match[1]) {
        fields.fragmentSize = match[1].trim()
        break
      }
    }

    for (const pattern of flowCellPatterns) {
      const match = rawText.match(pattern)
      if (match && match[1]) {
        fields.flowCellType = match[1].trim() as any
        break
      }
    }

    for (const pattern of basecallingPatterns) {
      const match = rawText.match(pattern)
      if (match && match[1]) {
        fields.basecalling = match[1].trim().replace(/\s+/g, ' ') as any
        break
      }
    }

    return fields
  }

  /**
   * Merge LLM and pattern matching results
   */
  private mergeExtractionResults(
    llmData: NanoporeFormData,
    patternData: NanoporeFormData,
  ): NanoporeFormData {
    return {
      // Prefer LLM results, fall back to pattern matching
      sampleName: llmData.sampleName || patternData.sampleName || undefined,
      submitterName: llmData.submitterName || patternData.submitterName || undefined,
      submitterEmail: llmData.submitterEmail || patternData.submitterEmail || undefined,
      labName: llmData.labName || patternData.labName || undefined,
      projectName: llmData.projectName || patternData.projectName || undefined,
      sequencingType: llmData.sequencingType || patternData.sequencingType || undefined,
      sampleType: llmData.sampleType || patternData.sampleType || undefined,
      libraryType: llmData.libraryType || patternData.libraryType || undefined,
      flowCellType: llmData.flowCellType || patternData.flowCellType || undefined,
      concentration: llmData.concentration || patternData.concentration || undefined,
      volume: llmData.volume || patternData.volume || undefined,
      purity: llmData.purity || patternData.purity || undefined,
      fragmentSize: llmData.fragmentSize || patternData.fragmentSize || undefined,
      priority: llmData.priority || patternData.priority || undefined,
      basecalling: llmData.basecalling || patternData.basecalling || undefined,
      demultiplexing: llmData.demultiplexing || patternData.demultiplexing || false,
      referenceGenome: llmData.referenceGenome || patternData.referenceGenome || undefined,
      analysisType: llmData.analysisType || patternData.analysisType || undefined,
      dataDelivery: llmData.dataDelivery || patternData.dataDelivery || undefined,
      confidence: Math.max(llmData.confidence, patternData.confidence),
      extractionMethod: 'hybrid',
      issues: [...(llmData.issues || []), ...(patternData.issues || [])],
    }
  }

  /**
   * Validate extracted form data and calculate confidence
   */
  private validateExtractedData(data: NanoporeFormData): string[] {
    const issues: string[] = []
    let confidence = data.confidence || 0.5

    // Required fields validation
    if (!data.sampleName) {
      issues.push('Sample name is required')
      confidence *= 0.7
    }

    if (!data.submitterName) {
      issues.push('Submitter name is required')
      confidence *= 0.8
    }

    if (!data.submitterEmail) {
      issues.push('Submitter email is required')
      confidence *= 0.8
    } else {
      // Email format validation
      const emailRegex = /^[\w%+.-]+@[\d.A-Za-z-]+\.[A-Za-z]{2,}$/
      if (!emailRegex.test(data.submitterEmail)) {
        issues.push('Invalid email format')
        confidence *= 0.9
      }
    }

    // Concentration validation
    if (data.concentration) {
      const concRegex =
        /^[\d.]+\s*(?:ng\/μl|ng\/ul|ng\/ml|μg\/μl|μg\/ul|μg\/ml|nm|μm)$/i
      if (!concRegex.test(data.concentration)) {
        issues.push('Invalid concentration format')
        confidence *= 0.95
      }
    }

    // Volume validation
    if (data.volume) {
      const volRegex = /^[\d.]+\s*(?:μl|ul|ml|l)$/i
      if (!volRegex.test(data.volume)) {
        issues.push('Invalid volume format')
        confidence *= 0.95
      }
    }

    // Calculate final confidence based on field completeness
    const totalFields = 19 // Total possible fields
    const filledFields = Object.values(data).filter(
      (v) => v !== undefined && v !== null && v !== '',
    ).length
    const completeness = filledFields / totalFields

    data.confidence = Math.min(confidence * (0.5 + completeness * 0.5), 1.0)

    return issues
  }
}

// Export singleton instance
export const nanoporeFormService = new NanoporeFormExtractionService()
