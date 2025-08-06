// Dynamic import to avoid pdf-parse initialization issues
import { nanoporeFormService } from './nanopore-llm-service'
import type { PDFProcessingResult } from '@/types/nanopore-submission'

interface PDFSubmissionData {
  // Submission-level data (shared across all samples)
  submitter_name: string
  submitter_email: string
  lab_name?: string
  department?: string
  billing_account?: string
  project_id?: string
  project_name?: string
  special_instructions?: string
  
  // Sample data
  samples: Array<{
    sample_name: string
    sample_type?: string
    concentration?: number
    volume?: number
    flow_cell_type?: string
    organism?: string
    genome_size?: string
    buffer?: string
    [key: string]: any // Allow other fields
  }>
}

/**
 * Extract submission and sample data from a PDF
 */
export async function processPDFSubmission(file: File): Promise<PDFProcessingResult> {
  try {
    // First, extract text from PDF
    const { pdfTextService } = await import('./pdf-text-extraction')
    const textResult = await pdfTextService.extractText(file)
    if (!textResult.success || !textResult.data) {
      throw new Error(textResult.error || 'Failed to extract text from PDF')
    }

    // Try to extract form data using LLM
    const formResult = await nanoporeFormService.extractFormData(file)
    
    // Extract submission-level data
    const submissionData = {
      pdf_filename: file.name,
      submitter_name: '',
      submitter_email: '',
      lab_name: undefined as string | undefined,
      department: undefined as string | undefined,
      billing_account: undefined as string | undefined,
      project_id: undefined as string | undefined,
      project_name: undefined as string | undefined,
      special_instructions: undefined as string | undefined,
      pdf_metadata: textResult.data.metadata,
      extracted_data: {} as any,
      extraction_method: 'pattern' as 'llm' | 'pattern' | 'hybrid' | 'rag',
      extraction_confidence: 0.5,
    }

    // Initialize samples array
    const samples: PDFProcessingResult['samples'] = []

    if (formResult.success && formResult.data) {
      const data = formResult.data
      
      // Update submission data
      submissionData.submitter_name = data.submitterName || ''
      submissionData.submitter_email = data.submitterEmail || ''
      submissionData.lab_name = data.labName || undefined
      submissionData.project_name = data.projectName
      submissionData.extraction_method = (data.extractionMethod === 'llm' || data.extractionMethod === 'hybrid' || data.extractionMethod === 'rag') 
        ? data.extractionMethod 
        : 'pattern'
      submissionData.extraction_confidence = data.confidence || 0.5
      
      // Store all extracted data
      submissionData.extracted_data = data
      
      // For now, create a single sample from the form data
      // TODO: Implement multi-sample extraction from table data
      const sample: any = {
        sample_name: data.sampleName || 'Sample-1',
        sample_type: data.sampleType || 'DNA',
      }
      
      if (data.concentration) {
        sample.concentration = parseFloat(data.concentration)
      }
      if (data.volume) {
        sample.volume = parseFloat(data.volume)
      }
      if (data.flowCellType) {
        sample.flow_cell_type = data.flowCellType
      }
      
      samples.push(sample)
      
      // Update billing account from samples if not set
      if (!submissionData.billing_account && samples.length > 0) {
        const firstSampleBilling = (samples[0] as any).billing_account
        if (firstSampleBilling) {
          submissionData.billing_account = firstSampleBilling
        }
      }
    } else {
      // Fallback: try to extract basic info from raw text
      const rawText = textResult.data.rawText
      
      // Try to extract submitter info
      const emailMatch = rawText.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/i)
      if (emailMatch) {
        submissionData.submitter_email = emailMatch[0]
      }
      
      // Try to extract names (basic heuristic)
      const nameMatch = rawText.match(/(?:name|submitter|submitted by)[\s:]*([A-Za-z\s'-]+)/i)
      if (nameMatch) {
        submissionData.submitter_name = nameMatch[1].trim()
      }
      
      // If no samples extracted, create a placeholder
      if (samples.length === 0) {
        samples.push({
          sample_name: 'Sample-1',
          sample_type: 'DNA',
        })
      }
    }

    // Ensure we have required fields
    if (!submissionData.submitter_name) {
      submissionData.submitter_name = 'Unknown Submitter'
    }
    if (!submissionData.submitter_email) {
      submissionData.submitter_email = 'unknown@email.com'
    }

    return {
      submission: {
        pdf_filename: submissionData.pdf_filename,
        submitter_name: submissionData.submitter_name,
        submitter_email: submissionData.submitter_email,
        lab_name: submissionData.lab_name,
        department: submissionData.department,
        billing_account: submissionData.billing_account,
        project_id: submissionData.project_id,
        project_name: submissionData.project_name,
        special_instructions: submissionData.special_instructions,
        pdf_metadata: submissionData.pdf_metadata,
        extracted_data: submissionData.extracted_data,
        extraction_method: submissionData.extraction_method,
        extraction_confidence: submissionData.extraction_confidence,
      },
      samples,
    }
  } catch (error) {
    console.error('Error processing PDF submission:', error)
    throw error
  }
} 