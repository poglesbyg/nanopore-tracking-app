/**
 * Submission Service Configuration with DNS Fallback
 * Handles DNS resolution issues in OpenShift/Kubernetes environments
 */

interface ServiceConfig {
  baseUrl: string
  timeout: number
  retries: number
  fallbackHosts: string[]
}

class SubmissionServiceClient {
  private config: ServiceConfig
  private currentHostIndex = 0

  constructor() {
    this.config = this.getServiceConfig()
  }

  private getServiceConfig(): ServiceConfig {
    // Primary service URL using Kubernetes service discovery
    const primaryUrl = process.env.SUBMISSION_SERVICE_URL || 'http://submission-service:8000'
    
    // Fallback URLs for DNS resolution issues
    const fallbackUrls = [
      'http://submission-service.dept-barc.svc.cluster.local:8000',
      'http://submission-service.dept-barc.svc:8000',
      'http://submission-service.dept-barc:8000'
    ]

    // Add service IP as last resort if available
    if (process.env.SUBMISSION_SERVICE_IP) {
      fallbackUrls.push(`http://${process.env.SUBMISSION_SERVICE_IP}:8000`)
    }

    return {
      baseUrl: primaryUrl,
      timeout: 10000,
      retries: 3,
      fallbackHosts: fallbackUrls
    }
  }

  private async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const urls = [this.config.baseUrl, ...this.config.fallbackHosts]
    let lastError: Error | null = null

    for (let attempt = 0; attempt < urls.length; attempt++) {
      const url = `${urls[attempt]}${path}`
      
      try {
        console.log(`Attempting request to: ${url}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          console.log(`✅ Request successful to: ${url}`)
          return response
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        lastError = error as Error
        console.warn(`❌ Request failed to ${url}:`, error)
        
        // If this is not the last attempt, continue to next URL
        if (attempt < urls.length - 1) {
          console.log(`Trying next fallback URL...`)
          continue
        }
      }
    }

    throw new Error(`All service URLs failed. Last error: ${lastError?.message}`)
  }

  async getHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await this.makeRequest('/api/v1/health')
    return await response.json()
  }

  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth()
      return health.status === 'healthy'
    } catch (error) {
      console.error('Submission service not available:', error)
      return false
    }
  }

  async processFile(file: File, type: 'pdf' | 'csv'): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)

    const endpoint = type === 'pdf' ? '/api/v1/process-pdf' : '/api/v1/process-csv'
    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      body: formData
    })

    return await response.json()
  }
}

// Export singleton instance
export const submissionService = new SubmissionServiceClient()

// Export for testing
export { SubmissionServiceClient } 