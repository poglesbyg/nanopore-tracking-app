// PDF processing types and interfaces

interface HTSFSample {
  sample_id: string
  sample_name: string
  concentration?: string
  concentration_unit?: string
  volume?: string
  volume_unit?: string
  sample_type?: string
}

interface HTSFQuoteData {
  submitter_name?: string
  submitter_email?: string
  chart_field?: string
  department?: string
  project_title?: string
  quote_number?: string
  samples: HTSFSample[]
}

export async function processHTSFPdf(file: File): Promise<HTSFQuoteData> {
  // For now, we'll use a simplified extraction based on common HTSF patterns
  // In production, this would use actual PDF parsing libraries
  
  const fileName = file.name
  const result: HTSFQuoteData = {
    samples: []
  }

  // Extract quote number from filename (e.g., HTSF--JL-147_quote_160217072025.pdf)
  const quoteMatch = fileName.match(/HTSF--([A-Z]+-\d+)/i)
  if (quoteMatch?.[1]) {
    result.quote_number = quoteMatch[1]
    result.chart_field = `HTSF-${quoteMatch[1]}`
  }

  // Since we can't actually parse the PDF in the browser without a library,
  // we'll return structured data that would typically be extracted
  // In a real implementation, this would use pdf.js or similar
  
  // Mock extraction based on typical HTSF quote structure
  result.submitter_name = "Dr. Jennifer Liu"
  result.submitter_email = "jliu@university.edu"
  result.department = "Molecular Biology"
  result.project_title = "Nanopore Sequencing Project - " + (result.quote_number || "Unknown")
  
  // Mock sample data that would be extracted from the PDF table
  // Generate unique sample IDs to avoid duplicates
  const timestamp = Date.now().toString().slice(-6) // Last 6 digits of timestamp
  result.samples = [
    {
      sample_id: `MOCK-${timestamp}-001`,
      sample_name: "Mock Sample A - DNA Extract",
      concentration: "150",
      concentration_unit: "ng/μL",
      volume: "30",
      volume_unit: "μL",
      sample_type: "DNA"
    },
    {
      sample_id: `MOCK-${timestamp}-002`, 
      sample_name: "Mock Sample B - DNA Extract",
      concentration: "125",
      concentration_unit: "ng/μL",
      volume: "30",
      volume_unit: "μL",
      sample_type: "DNA"
    },
    {
      sample_id: `MOCK-${timestamp}-003`,
      sample_name: "Mock Sample C - Control",
      concentration: "200",
      concentration_unit: "ng/μL",
      volume: "25",
      volume_unit: "μL",
      sample_type: "DNA"
    }
  ]

  return result
}

// Helper function to validate HTSF quote data
export function validateHTSFData(data: HTSFQuoteData): string[] {
  const errors: string[] = []
  
  if (!data.samples || data.samples.length === 0) {
    errors.push("No samples found in PDF")
  }
  
  data.samples.forEach((sample, index) => {
    if (!sample.sample_id) {
      errors.push(`Sample ${index + 1} is missing sample ID`)
    }
    if (!sample.sample_name) {
      errors.push(`Sample ${index + 1} is missing sample name`)
    }
    
    // Validate concentration
    if (sample.concentration) {
      const conc = parseFloat(sample.concentration)
      if (isNaN(conc) || conc <= 0) {
        errors.push(`Sample ${sample.sample_id}: Invalid concentration value`)
      }
    }
    
    // Validate volume
    if (sample.volume) {
      const vol = parseFloat(sample.volume)
      if (isNaN(vol) || vol <= 0) {
        errors.push(`Sample ${sample.sample_id}: Invalid volume value`)
      }
    }
  })
  
  return errors
}