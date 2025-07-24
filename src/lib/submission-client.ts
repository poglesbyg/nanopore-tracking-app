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
  private useGateway: boolean

  constructor(baseUrl?: string, useGateway: boolean = true) {
    // Use API Gateway routes by default
    this.useGateway = useGateway
    if (useGateway) {
      // Use relative URLs to go through the API Gateway
      this.baseUrl = '/api/submission'
    } else {
      // Direct connection to submission service (for development/testing)
      this.baseUrl = baseUrl || process.env.SUBMISSION_SERVICE_URL || 'http://localhost:8000'
    }
  }

  /**
   * Process CSV file for bulk sample creation
   */
  async processCSV(file: File): Promise<ProcessingResult> {
    const formData = new FormData()
    formData.append('file', file)

    const url = this.useGateway 
      ? `${this.baseUrl}/process-csv`
      : `${this.baseUrl}/process-csv`

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        // Include auth headers if available
        'Authorization': localStorage.getItem('auth_token') || '',
        'X-User-Id': localStorage.getItem('user_id') || '',
      }
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

    const url = this.useGateway 
      ? `${this.baseUrl}/process-pdf`
      : `${this.baseUrl}/process-pdf`

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        // Include auth headers if available
        'Authorization': localStorage.getItem('auth_token') || '',
        'X-User-Id': localStorage.getItem('user_id') || '',
      }
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
    // Health check always goes direct to service
    const url = this.useGateway 
      ? `${this.baseUrl}/health`
      : `${this.baseUrl}/api/v1/health`
      
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryUsage(): Promise<HealthCheck['memory_usage']> {
    // Memory usage check always goes direct to service
    const url = this.useGateway 
      ? `${this.baseUrl}/memory-usage`
      : `${this.baseUrl}/memory-usage`
      
    const response = await fetch(url)

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
// This will use the API Gateway routes by default
export const submissionServiceClient = new SubmissionServiceClient(undefined, true)

// Export convenience functions
export const processCSV = (file: File) => submissionServiceClient.processCSV(file)
export const processPDF = (file: File) => submissionServiceClient.processPDF(file)
export const getSubmissionHealth = () => submissionServiceClient.getHealth()
export const getSubmissionMemoryUsage = () => submissionServiceClient.getMemoryUsage()
export const isSubmissionServiceAvailable = () => submissionServiceClient.isAvailable() 