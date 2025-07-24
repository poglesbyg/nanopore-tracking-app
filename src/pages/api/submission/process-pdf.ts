import type { APIRoute } from 'astro'
import container from '@/container'
import type { ISampleService } from '@/services/interfaces/ISampleService'
import { db } from '@/lib/database'

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

    // Save extracted data to database if extraction was successful
    let samplesCreated = 0
    let submissionId: string | null = null
    const isCompleted = data.status === 'completed' || 
                       data.status === 'ProcessingStatus.COMPLETED' || 
                       (typeof data.status === 'string' && data.status.toLowerCase().includes('completed'))
    
    if (isCompleted && extractedData) {
      try {
        const sampleService = container.get<ISampleService>('sampleService')
        
        // First, create a submission record for this PDF
        const submissionData = {
          pdf_filename: data.metadata?.filename || 'unknown.pdf',
          submitter_name: extractedData.submitter_name || 'Unknown',
          submitter_email: extractedData.submitter_email || 'unknown@email.com',
          lab_name: extractedData.lab_name || extractedData.metadata?.lab || null,
          department: extractedData.department || null,
          billing_account: extractedData.chart_field || extractedData.quote_identifier || null,
          project_id: extractedData.project_id || null,
          project_name: extractedData.project_name || null,
          status: 'processing' as const,
          sample_count: 0, // Will be updated after creating samples
          samples_completed: 0,
          pdf_metadata: data.metadata || {},
          extracted_data: extractedData,
          extraction_method: data.metadata?.ai_enhanced ? 'llm' : 'pattern',
          extraction_confidence: extractedData.extraction_confidence || 0.95,
          special_instructions: extractedData.special_instructions || null,
          priority: (extractedData.priority || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          created_by: '550e8400-e29b-41d4-a716-446655440000' // Demo user
        }
        
        // Create the submission
        const submission = await (db as any)
          .insertInto('nanopore_submissions')
          .values({
            ...submissionData,
            submission_date: new Date()
          })
          .returningAll()
          .executeTakeFirstOrThrow()
        
                submissionId = submission.id
        
        // Base sample data for all samples
        const baseSampleData = {
          submitterName: extractedData.submitter_name || 'Unknown',
          submitterEmail: extractedData.submitter_email || 'unknown@email.com',
          sampleType: extractedData.sample_type || 'DNA',
          organism: extractedData.organism || '',
          buffer: extractedData.buffer || '',
          chartField: extractedData.chart_field || extractedData.quote_identifier || 'HTSF-001',
          priority: extractedData.priority || 'normal',
          status: 'submitted',
          labName: extractedData.lab_name || extractedData.metadata?.lab || '',
          quoteIdentifier: extractedData.quote_identifier || '',
          submissionId: submissionId, // Link to submission
          // Additional extracted fields
          flowCellType: extractedData.flow_cell || null,
          flowCellCount: extractedData.flow_cell_count || 1,
          genomeSize: extractedData.genome_size || null,
          targetCoverage: extractedData.coverage ? extractedData.coverage.replace(/[^\dx-]/g, '') : null,
          basecallingModel: extractedData.basecalling || null,
          deliveryMethod: extractedData.data_delivery || null,
          estimatedCost: extractedData.cost ? parseFloat(extractedData.cost.replace(/[^\d.-]/g, '')) : null,
          metadata: {
            extractedFrom: data.metadata?.filename || 'PDF',
            extractionDate: new Date().toISOString(),
            fileFormat: extractedData.file_format || null,
            specialInstructions: extractedData.special_instructions || null,
            deliveryEmail: extractedData.delivery_email || null,
            ...extractedData.metadata
          }
        }
        
        // Only create samples from the sample table if it exists
        if (extractedData.sample_table && Array.isArray(extractedData.sample_table)) {
          let sampleNumber = 1
          for (let i = 0; i < extractedData.sample_table.length; i++) {
            const tableSample = extractedData.sample_table[i]
            
            // Skip entries that look like header data
            const sampleName = tableSample.sample_name || ''
            if (sampleName.toLowerCase() === 'ratio' || 
                sampleName.toLowerCase().includes('sample') && sampleName.toLowerCase().includes('name') ||
                sampleName.toLowerCase().includes('µl') ||
                sampleName.toLowerCase().includes('ng/µl')) {
              continue
            }
            
            try {
              const additionalSample = {
                ...baseSampleData,
                sampleName: sampleName || `Sample ${tableSample.sample_index || sampleNumber}`,
                concentration: tableSample.qubit_conc || tableSample.nanodrop_conc || null,
                volume: tableSample.volume || null,
                sampleNumber: sampleNumber,
                metadata: {
                  ...baseSampleData.metadata,
                  tableIndex: tableSample.sample_index,
                  fromSampleTable: true
                }
              }
              
              const created = await sampleService.createSample(additionalSample)
              if (created) {
                samplesCreated++
                sampleNumber++
              }
            } catch (err) {
              console.error('Error creating sample from table:', err)
            }
          }
        } else if (extractedData.sample_name && 
                   !extractedData.sample_name.toLowerCase().includes('volume') &&
                   !extractedData.sample_name.toLowerCase().includes('conc')) {
          // If no sample table but we have a valid sample name, create a single sample
          try {
            const singleSample = {
              ...baseSampleData,
              sampleName: extractedData.sample_name,
              concentration: extractedData.concentration || null,
              volume: extractedData.volume || null,
              sampleNumber: 1
            }
            
            const created = await sampleService.createSample(singleSample)
            if (created) {
              samplesCreated = 1
            }
          } catch (err) {
            console.error('Error creating single sample:', err)
          }
        }
        
        // Update submission with final sample count
        if (submissionId && samplesCreated > 0) {
          await db
            .updateTable('nanopore_submissions')
            .set({
              sample_count: samplesCreated,
              status: 'completed'
            })
            .where('id', '=', submissionId)
            .execute()
        }
      } catch (error) {
        console.error('Error saving extracted data:', error)
      }
    }

    // Transform the response to match the ProcessingResult interface
    const transformedResponse = {
      success: isCompleted && samplesCreated > 0,
      message: data.message || `Successfully processed PDF: ${data.metadata?.filename || 'unknown'}`,
      samples_processed: data.data ? (Array.isArray(data.data) ? data.data.length : 1) : 0,
      samples_created: samplesCreated,
      errors: data.errors || [],
      processing_time: data.processing_time || 0,
      submissionId: submissionId,
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