import type { APIRoute } from 'astro'
import container from '@/container'
import type { ISampleService } from '@/services/interfaces/ISampleService'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get the submission service URL from environment
    const submissionServiceUrl = process.env.SUBMISSION_SERVICE_URL || 'http://localhost:8000'
    
    // Get the form data from the request
    const formData = await request.formData()
    
    // Forward the request to the submission service
    const response = await fetch(`${submissionServiceUrl}/api/v1/process-pdf`, {
      method: 'POST',
      body: formData,
      headers: {
        // Forward any auth headers if present
        'Authorization': request.headers.get('Authorization') || '',
        'X-User-Id': request.headers.get('X-User-Id') || '',
      }
    })

    // Get the response data
    const data = await response.json()

    // Extract the first sample data if available
    let extractedData = null
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      extractedData = data.data[0]
    } else if (data.data && !Array.isArray(data.data)) {
      extractedData = data.data
    }

    // Save extracted sample to database if extraction was successful
    let samplesCreated = 0
    const isCompleted = data.status === 'completed' || 
                       data.status === 'ProcessingStatus.COMPLETED' || 
                       (typeof data.status === 'string' && data.status.toLowerCase().includes('completed'))
    
    console.log('PDF Processing Status:', data.status, 'isCompleted:', isCompleted, 'hasExtractedData:', !!extractedData)
    
    if (isCompleted && extractedData) {
      try {
        const sampleService = container.get<ISampleService>('sampleService')
        
        // Create sample data with defaults for missing fields
        const sampleData = {
          sampleName: extractedData.sample_name || 'Unknown Sample',
          submitterName: extractedData.submitter_name || 'Unknown',
          submitterEmail: extractedData.submitter_email || 'unknown@email.com',
          sampleType: extractedData.sample_type || 'DNA',
          organism: extractedData.organism || '',
          concentration: extractedData.concentration || null,
          volume: extractedData.volume || null,
          buffer: extractedData.buffer || '',
          chartField: extractedData.chart_field || extractedData.quote_identifier || 'HTSF-001',
          priority: extractedData.priority || 'normal',
          status: 'submitted',
          labName: extractedData.lab_name || extractedData.metadata?.lab || '',
          quoteIdentifier: extractedData.quote_identifier || '',
          metadata: {
            extractedFrom: data.metadata?.filename || 'PDF',
            extractionDate: new Date().toISOString(),
            ...extractedData.metadata
          }
        }

        // Create the sample
        console.log('Creating sample with data:', sampleData)
        const createdSample = await sampleService.createSample(sampleData)
        if (createdSample) {
          samplesCreated = 1
          console.log('Successfully created primary sample:', createdSample.id)
        } else {
          console.log('Failed to create primary sample')
        }

        // If there's a sample table with multiple samples, create them too
        if (extractedData.sample_table && Array.isArray(extractedData.sample_table)) {
          for (const tableSample of extractedData.sample_table) {
            try {
              const additionalSample = {
                ...sampleData,
                sampleName: tableSample.sample_name || `Sample ${tableSample.sample_index || 'Unknown'}`,
                concentration: tableSample.qubit_conc || tableSample.nanodrop_conc || null,
                volume: tableSample.volume || null,
                metadata: {
                  ...sampleData.metadata,
                  tableIndex: tableSample.sample_index,
                  fromSampleTable: true
                }
              }
              
              const created = await sampleService.createSample(additionalSample)
              if (created) {
                samplesCreated++
              }
            } catch (err) {
              console.error('Error creating sample from table:', err)
            }
          }
        }
      } catch (error) {
        console.error('Error saving extracted sample:', error)
        console.error('Error details:', error instanceof Error ? error.message : error)
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
      }
    }

    // Transform the response to match the ProcessingResult interface
    const transformedResponse = {
      success: data.status === 'completed',
      message: data.message || `Successfully processed PDF: ${data.metadata?.filename || 'unknown'}`,
      samples_processed: data.data ? (Array.isArray(data.data) ? data.data.length : 1) : 0,
      samples_created: samplesCreated,
      errors: data.errors || [],
      processing_time: data.processing_time || 0,
      // Include the extracted data for the frontend
      extractedData: extractedData,
      metadata: data.metadata
    }

    // Return the transformed response
    return new Response(JSON.stringify(transformedResponse), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error processing PDF:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to process PDF',
        samples_processed: 0,
        samples_created: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processing_time: 0
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
} 