import type { APIRoute } from 'astro'
import container from '@/container'
import type { ISampleService } from '@/services/interfaces/ISampleService'
import { db } from '@/lib/database'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get the submission service URL from environment
    const submissionServiceUrl = process.env.SUBMISSION_SERVICE_URL || 'http://submission-service:8000'

    // Get the form data from the request. If the client sent a raw PDF
    // (Content-Type: application/pdf), wrap it into multipart/form-data
    // under the field name "file" so the submission service accepts it.
    let formData: FormData
    try {
      formData = await request.formData()
      // If no file provided (e.g., incorrect field), attempt to read raw body
      if (![...formData.keys()].includes('file')) {
        const buff = await request.arrayBuffer()
        const pdfBlob = new Blob([buff], { type: 'application/pdf' })
        formData = new FormData()
        formData.append('file', pdfBlob, 'upload.pdf')
      }
    } catch {
      const buff = await request.arrayBuffer()
      const pdfBlob = new Blob([buff], { type: 'application/pdf' })
      formData = new FormData()
      formData.append('file', pdfBlob, 'upload.pdf')
    }
    
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
    let extractedData: any = null
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      extractedData = data.data[0]
    } else if (data?.data && !Array.isArray(data.data)) {
      extractedData = data.data
    }

    // Save extracted data to database if extraction was successful
    let samplesCreated = 0
    let submissionId: string | null = null
    const ingestErrors: string[] = []
    const isCompleted = data.status === 'completed' || 
                       data.status === 'ProcessingStatus.COMPLETED' || 
                       (typeof data.status === 'string' && data.status.toLowerCase().includes('completed'))
    
    if (isCompleted) {
      try {
        // Prefer ingestion endpoint to persist in a single transaction when we have a table
        const origin = new URL(request.url).origin
        if (extractedData?.sample_table && Array.isArray(extractedData.sample_table) && extractedData.sample_table.length > 0) {
          const samplesForIngest = extractedData.sample_table
            .map((row: any, idx: number) => {
              const name = (row.sample_name || '').toString().trim()
              // Skip header-like rows
              const lower = name.toLowerCase()
              if (!name || lower === 'ratio' || (lower.includes('sample') && lower.includes('name')) || lower.includes('µl') || lower.includes('ng/µl')) {
                return null
              }
              return {
                sample_name: name,
                sample_type: extractedData?.sample_type || 'DNA',
                volume: row.volume ?? null,
                volume_unit: 'μL',
                nanodrop_conc: row.nanodrop_conc ?? null,
                qubit_conc: row.qubit_conc ?? null,
                a260_280: row.a260_280 ?? null,
                a260_230: row.a260_230 ?? null,
                sample_number: row.sample_index || (idx + 1),
              }
            })
            .filter(Boolean)

          const submissionPayload = {
            pdf_filename: data.metadata?.filename || 'unknown.pdf',
            submitter_name: extractedData?.submitter_name || 'Unknown',
            submitter_email: extractedData?.submitter_email || 'unknown@email.com',
            lab_name: extractedData?.lab_name || extractedData?.metadata?.lab || null,
            department: extractedData?.department || null,
            project_id: extractedData?.project_id || null,
            project_name: extractedData?.project_name || null,
            pdf_metadata: data.metadata || {},
            extracted_data: extractedData || {},
            extraction_method: data.metadata?.ai_enhanced ? 'llm' : 'pattern',
            extraction_confidence: extractedData?.extraction_confidence || 0.95,
            priority: ((extractedData?.priority as any) || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
          }

          try {
            const ingestRes = await fetch(`${origin}/api/submissions/ingest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ submission: submissionPayload, samples: samplesForIngest })
            })
            const ingestJson = await ingestRes.json().catch(() => ({}))
            if (ingestRes.ok && ingestJson?.success) {
              submissionId = ingestJson.submissionId || null
              samplesCreated = Number(ingestJson.samples_created || 0)
            } else {
              ingestErrors.push(ingestJson?.message || 'Ingestion failed')
            }
          } catch (e) {
            ingestErrors.push(e instanceof Error ? e.message : 'Failed to call ingestion endpoint')
          }

          // Fallback: if ingestion failed to create samples, persist directly
          if (!samplesCreated) {
            try {
              // Create submission if not set
              if (!submissionId) {
                const sub = await (db as any)
                  .insertInto('nanopore_submissions')
                  .values({
                    pdf_filename: submissionPayload.pdf_filename,
                    submitter_name: submissionPayload.submitter_name,
                    submitter_email: submissionPayload.submitter_email,
                    lab_name: submissionPayload.lab_name,
                    department: submissionPayload.department,
                    project_id: submissionPayload.project_id,
                    project_name: submissionPayload.project_name,
                    status: 'processing',
                    sample_count: 0,
                    samples_completed: 0,
                    pdf_metadata: submissionPayload.pdf_metadata,
                    extracted_data: submissionPayload.extracted_data,
                    extraction_method: submissionPayload.extraction_method,
                    extraction_confidence: submissionPayload.extraction_confidence,
                    priority: submissionPayload.priority,
                    created_by: '550e8400-e29b-41d4-a716-446655440000',
                    submission_date: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                submissionId = sub.id
              }

              const sampleService = container.get<ISampleService>('sampleService')
              let createdCount = 0
              let seq = 1
              for (const row of samplesForIngest) {
                const name = row.sample_name
                if (!name) continue
                try {
                  const created = await sampleService.createSample({
                    sampleName: name,
                    submitterName: submissionPayload.submitter_name,
                    submitterEmail: submissionPayload.submitter_email,
                    sampleType: row.sample_type || 'DNA',
                    concentration: row.nanodrop_conc ?? row.qubit_conc ?? null,
                    volume: row.volume ?? null,
                    chartField: 'HTSF-001',
                    priority: submissionPayload.priority,
                    submissionId: submissionId as any,
                    sampleNumber: row.sample_number || seq,
                    labName: submissionPayload.lab_name || '',
                  } as any)
                  if (created) {
                    createdCount++
                    seq++
                  }
                } catch (err) {
                  ingestErrors.push(err instanceof Error ? err.message : 'Failed to create sample (fallback)')
                }
              }

              samplesCreated = createdCount

              await db
                .updateTable('nanopore_submissions')
                .set({ sample_count: samplesCreated, status: samplesCreated > 0 ? 'completed' : 'processing', updated_at: new Date() })
                .where('id', '=', submissionId as string)
                .execute()
            } catch (err) {
              ingestErrors.push(err instanceof Error ? err.message : 'Fallback persistence failed')
            }
          }
        } else if (extractedData?.sample_name && !extractedData.sample_name.toLowerCase().includes('volume') && !extractedData.sample_name.toLowerCase().includes('conc')) {
          // If no table, fallback to creating a single sample using service
          const sampleService = container.get<ISampleService>('sampleService')
          try {
            // Create a submission row first
            const submission = await (db as any)
              .insertInto('nanopore_submissions')
              .values({
                pdf_filename: data.metadata?.filename || 'unknown.pdf',
                submitter_name: extractedData?.submitter_name || 'Unknown',
                submitter_email: extractedData?.submitter_email || 'unknown@email.com',
                lab_name: extractedData?.lab_name || extractedData?.metadata?.lab || null,
                department: extractedData?.department || null,
                project_id: extractedData?.project_id || null,
                project_name: extractedData?.project_name || null,
                status: 'processing',
                sample_count: 0,
                samples_completed: 0,
                pdf_metadata: data.metadata || {},
                extracted_data: extractedData || {},
                extraction_method: data.metadata?.ai_enhanced ? 'llm' : 'pattern',
                extraction_confidence: extractedData?.extraction_confidence || 0.95,
                special_instructions: extractedData?.special_instructions || null,
                priority: ((extractedData?.priority as any) || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
                created_by: '550e8400-e29b-41d4-a716-446655440000',
                submission_date: new Date()
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            submissionId = submission.id

            const created = await sampleService.createSample({
              submitterName: extractedData?.submitter_name || 'Unknown',
              submitterEmail: extractedData?.submitter_email || 'unknown@email.com',
              sampleType: extractedData?.sample_type || 'DNA',
              sampleName: extractedData.sample_name,
              concentration: extractedData.concentration || null,
              volume: extractedData.volume || null,
              chartField: extractedData?.chart_field || extractedData?.quote_identifier || 'HTSF-001',
              priority: (extractedData?.priority as any) || 'normal',
              flowCellType: extractedData?.flow_cell || null,
              flowCellCount: extractedData?.flow_cell_count || 1,
              submissionId,
              sampleNumber: 1,
              labName: extractedData?.lab_name || extractedData?.metadata?.lab || '',
            } as any)
            if (created) {
              samplesCreated = 1
              await db.updateTable('nanopore_submissions').set({ sample_count: 1, status: 'completed' }).where('id', '=', submissionId).execute()
            }
          } catch (err) {
            ingestErrors.push(err instanceof Error ? err.message : 'Error creating single sample')
          }
        }
      } catch (error) {
        console.error('Error saving extracted data:', error)
        ingestErrors.push(error instanceof Error ? error.message : 'Unknown error saving extracted data')
      }
    }

    // Calculate processed rows: prefer table row count if present
    const processedCount = extractedData?.sample_table && Array.isArray(extractedData.sample_table)
      ? extractedData.sample_table.length
      : (data?.data ? (Array.isArray(data.data) ? data.data.length : 1) : 0)

    // Transform the response to match the ProcessingResult interface
    const transformedResponse = {
      success: Boolean(isCompleted && submissionId !== null),
      message: data.message || `Successfully processed PDF: ${data.metadata?.filename || 'unknown'}`,
      samples_processed: processedCount,
      samples_created: samplesCreated,
      errors: [...(data.errors || []), ...ingestErrors],
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