// Simple test script to verify submission functionality
import { processPDFSubmission } from './src/lib/ai/pdf-submission-processor.js'
import fs from 'fs'

async function testSubmissionProcessing() {
  try {
    console.log('🧪 Testing PDF submission processing...')
    
    // Check if sample PDF exists
    const pdfPath = './HTSF--JL-147_quote_160217072025.pdf'
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Sample PDF not found:', pdfPath)
      return
    }
    
    // Create a File-like object for testing
    const pdfBuffer = fs.readFileSync(pdfPath)
    const file = new File([pdfBuffer], 'test-submission.pdf', { type: 'application/pdf' })
    
    console.log('📄 Processing PDF:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`)
    
    // Process the PDF
    const result = await processPDFSubmission(file)
    
    console.log('✅ Processing completed!')
    console.log('📊 Results:')
    console.log('  - Submission data:', {
      submitter_name: result.submission.submitter_name,
      submitter_email: result.submission.submitter_email,
      lab_name: result.submission.lab_name,
      extraction_method: result.submission.extraction_method,
      extraction_confidence: result.submission.extraction_confidence
    })
    console.log('  - Sample count:', result.samples.length)
    
    result.samples.forEach((sample, index) => {
      console.log(`  - Sample ${index + 1}:`, {
        name: sample.sample_name,
        type: sample.sample_type,
        concentration: sample.concentration,
        volume: sample.volume
      })
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
  }
}

// Run the test
testSubmissionProcessing() 