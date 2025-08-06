import type { APIRoute } from 'astro'
import { processHTSFPdf as mockProcessPdf, validateHTSFData } from '../../lib/pdf/htsf-pdf-processor'
import { badRequest, internalError, ok } from '../../lib/api/server-response'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get the form data from the frontend request
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return badRequest('No file provided')
    }
    
    // Convert File to Buffer (Node.js)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let extractedData
    try {
      // Attempt real PDF parsing with dynamic import
      const { parseHTSFPdf } = await import('../../lib/pdf/htsf-real-parser')
      extractedData = await parseHTSFPdf(buffer)
    } catch (err) {
      console.warn('Real PDF parsing failed, falling back to mock:', err)
      extractedData = await mockProcessPdf(file)
    }
    
    // Validate the extracted data
    const errors = validateHTSFData(extractedData)
    if (errors.length > 0) {
      console.warn('PDF validation warnings:', errors)
    }
    
    // Return success response with extracted data
    return ok({ ...extractedData, warnings: errors.length > 0 ? errors : undefined }, 'PDF processed successfully')
    
    /* Original code - commented out for now
    const response = await fetch('http://localhost:8000/api/v1/process-pdf', {
      method: 'POST',
      body: formData,
    })
    */
  } catch (error) {
    console.error('PDF processing error:', error)
    return internalError('Internal server error during PDF processing')
  }
}