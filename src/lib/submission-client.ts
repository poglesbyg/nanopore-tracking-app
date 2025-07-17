/**
 * Submission Service Client
 * Communicates with the Python-based submission service for PDF/CSV processing
 */

// No imports needed for this client

export interface ProcessingResult {
  success: boolean
  message: string
  samples_processed: number
  samples_created: number
  errors: string[]
  processing_time: number
}

export interface HealthCheck {
  status: string
  memory_usage: {
    rss_mb: number
    vms_mb: number
    percent: number
    available_mb: number
  }
  service: string
}

export class SubmissionServiceClient {
  private baseUrl: string

  constructor(baseUrl: string = process.env.SUBMISSION_SERVICE_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl
  }

  /**
   * Process CSV file for bulk sample creation
   */
  async processCSV(file: File): Promise<ProcessingResult> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/process-csv`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`CSV processing failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Process PDF file for sample data extraction
   */
  async processPDF(file: File): Promise<ProcessingResult> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/process-pdf`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`PDF processing failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<HealthCheck> {
    const response = await fetch(`${this.baseUrl}/health`)

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryUsage(): Promise<HealthCheck['memory_usage']> {
    const response = await fetch(`${this.baseUrl}/memory-usage`)

    if (!response.ok) {
      throw new Error(`Memory usage check failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Check if submission service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth()
      return health.status === 'healthy' || health.status === 'degraded'
    } catch (error) {
      console.warn('Submission service not available:', error)
      return false
    }
  }
}

// Export singleton instance
export const submissionServiceClient = new SubmissionServiceClient()

// Export convenience functions
export const processCSV = (file: File) => submissionServiceClient.processCSV(file)
export const processPDF = (file: File) => submissionServiceClient.processPDF(file)
export const getSubmissionHealth = () => submissionServiceClient.getHealth()
export const getSubmissionMemoryUsage = () => submissionServiceClient.getMemoryUsage()
export const isSubmissionServiceAvailable = () => submissionServiceClient.isAvailable() 