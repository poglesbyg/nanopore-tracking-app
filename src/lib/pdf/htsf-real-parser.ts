// Dynamic import to avoid loading pdf-parse debug code during module initialization

interface HTSFSample {
  sample_id: string
  sample_name: string
  concentration?: string
  concentration_unit?: string
  volume?: string
  volume_unit?: string
  sample_type?: string
}

export interface HTSFQuoteData {
  submitter_name?: string
  submitter_email?: string
  chart_field?: string
  department?: string
  project_title?: string
  quote_number?: string
  samples: HTSFSample[]
}

/**
 * Very small helper to normalise whitespace for easier regex matching.
 */
function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
}

/**
 * Extract samples from real HTSF PDF format.
 * Format: {number}{volume}{concentration}.{ratio} packed together
 * Example: "112298.91.84 232314.051.84 352348.21.84"
 */
function extractSamples(text: string): HTSFSample[] {
  const samples: HTSFSample[] = []
  
  // Remove headers and normalize whitespace
  const cleanText = text.replace(/Sample NameVolume[\s\S]*?ratio\s*/i, '').trim()
  
  // Pattern to match: number + volume + concentration + ratio
  // Example: "112298.91.84" = sample 1, volume 12, concentration 298.9, ratio 1.84
  const samplePattern = /(\d+)(\d{1,3})(\d{2,4}\.?\d{0,2})(1\.\d{2})/g
  
  let match
  while ((match = samplePattern.exec(cleanText)) !== null) {
    const [fullMatch, sampleNum, volume, concentration] = match
    
    // Skip if it doesn't look like a real sample (too short, etc.)
    if (fullMatch.length < 6 || !sampleNum || !volume || !concentration) continue
    
    // Parse volume and concentration more carefully
    const vol = parseInt(volume, 10)
    const conc = parseFloat(concentration)
    
    // Skip unrealistic values
    if (vol < 1 || vol > 999 || conc < 10 || conc > 9999) continue
    
    samples.push({
      sample_id: `JL-147-${sampleNum.padStart(3, '0')}`,
      sample_name: `Sample ${sampleNum}`,
      volume: vol.toString(),
      volume_unit: 'μL',
      concentration: conc.toString(),
      concentration_unit: 'ng/μL',
      sample_type: 'DNA'
    })
    
    // Limit to reasonable number of samples
    if (samples.length >= 100) break
  }
  
  console.log(`Regex matches found: ${samples.length}`)
  
  return samples
}

export async function parseHTSFPdf(buffer: Buffer): Promise<HTSFQuoteData> {
  // Dynamic import to avoid loading pdf-parse during module initialization
  const pdf = await import('pdf-parse').then(m => m.default || m)
  const data = await pdf(buffer)
  const text = normalise(data.text)

  // Debug logging to see what text we're working with
  console.log('=== PDF TEXT CONTENT ===')
  console.log(text)
  console.log('=== END PDF TEXT ===')

  const result: HTSFQuoteData = { samples: [] }

  // Quote number / chart field
  const quoteMatch = text.match(/HTSF--([A-Z]+-[0-9]+)/i)
  console.log('Quote match:', quoteMatch)
  if (quoteMatch?.[1]) {
    result.quote_number = quoteMatch[1]
    result.chart_field = `HTSF-${quoteMatch[1]}`
  }

  // Submitter name / email - Updated patterns for real HTSF format
  const submitterMatch = text.match(/Requester[:\s]*([A-Za-z ,.-]+)\s+E-mail/i)
  console.log('Submitter match:', submitterMatch)
  if (submitterMatch?.[1]) result.submitter_name = submitterMatch[1].trim()
  const emailMatch = text.match(/E-mail[:\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+)/i)
  console.log('Email match:', emailMatch)
  if (emailMatch?.[1]) result.submitter_email = emailMatch[1]

  // Department / project title
  const deptMatch = text.match(/Department[:\s]+([A-Za-z0-9 ,.-]+)/i)
  console.log('Department match:', deptMatch)
  if (deptMatch?.[1]) result.department = deptMatch[1].trim()
  const titleMatch = text.match(/Project Title[:\s]+(.+?) Quote/i)
  console.log('Title match:', titleMatch)
  if (titleMatch?.[1]) result.project_title = titleMatch[1].trim()

  // Sample table – Updated pattern for real HTSF format
  const tableMatch = text.match(/Sample NameVolume[\s\S]+?(?:Flow Cell Selection|Bioinformatics|$)/i)
  console.log('Table match:', tableMatch ? 'Found table section' : 'No table found')
  if (tableMatch) {
    const tableText = tableMatch[0]
    console.log('Table text (first 500 chars):', tableText.substring(0, 500))
    result.samples = extractSamples(tableText)
    console.log('Extracted samples:', result.samples)
  }

  return result
}
