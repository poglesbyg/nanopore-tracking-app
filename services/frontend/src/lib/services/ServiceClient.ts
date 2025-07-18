import { CircuitBreaker, type CircuitBreakerConfig } from '../resilience/CircuitBreaker'

interface ServiceEndpoint {
  hostname: string
  ip?: string | undefined
  port: number
  protocol: 'http' | 'https'
}

interface ServiceClientConfig {
  timeout: number
  retries: number
  retryDelay: number
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
  healthCheckInterval: number
}

interface ServiceHealth {
  healthy: boolean
  lastCheck: Date
  responseTime: number
  error?: string | undefined
}

export class ServiceClient {
  private config: ServiceClientConfig
  private circuitBreaker: CircuitBreaker
  private serviceHealth: Map<string, ServiceHealth> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<ServiceClientConfig> = {}) {
    this.config = {
      timeout: config.timeout || 10000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
      healthCheckInterval: config.healthCheckInterval || 30000
    }

    this.circuitBreaker = new CircuitBreaker({
      name: 'service-client',
      failureThreshold: this.config.circuitBreakerThreshold,
      resetTimeout: this.config.circuitBreakerTimeout,
      monitoringPeriod: 60000
    })

    this.startHealthChecks()
  }

  private getServiceEndpoints(): { [key: string]: ServiceEndpoint } {
    return {
      'submission-service': {
        hostname: 'submission-service.dept-barc.svc.cluster.local',
        ip: process.env.SUBMISSION_SERVICE_IP || '172.30.47.35',
        port: 8000,
        protocol: 'http'
      },
      'ai-service': {
        hostname: 'ai-service-optimized.dept-barc.svc.cluster.local',
        ip: process.env.AI_SERVICE_IP,
        port: 8001,
        protocol: 'http'
      },
      'database': {
        hostname: 'sequencing-consultant.dept-barc.svc.cluster.local',
        ip: process.env.DATABASE_IP || '172.30.29.148',
        port: 5432,
        protocol: 'http'
      }
    }
  }

  private async makeRequest(
    endpoint: ServiceEndpoint,
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const urls = [
      `${endpoint.protocol}://${endpoint.hostname}:${endpoint.port}${path}`,
      ...(endpoint.ip ? [`${endpoint.protocol}://${endpoint.ip}:${endpoint.port}${path}`] : [])
    ]

    let lastError: Error | null = null

    for (const url of urls) {
      try {
        console.log(`Attempting request to: ${url}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'nanopore-tracking-app/1.0',
            ...options.headers
          }
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return response
      } catch (error) {
        lastError = error as Error
        console.warn(`Request failed for ${url}:`, error)
        
        // If it's a DNS resolution error, try the next URL immediately
        if (error instanceof Error && (
          error.message.includes('EAI_AGAIN') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('getaddrinfo')
        )) {
          continue
        }

        // For other errors, wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
      }
    }

    throw lastError || new Error('All service endpoints failed')
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    serviceName: string
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        return await this.circuitBreaker.execute(operation)
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt}/${this.config.retries} failed for ${serviceName}:`, error)

        if (attempt < this.config.retries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // Update service health
    this.updateServiceHealth(serviceName, false, lastError?.message)
    throw lastError || new Error(`Service ${serviceName} failed after ${this.config.retries} attempts`)
  }

  private updateServiceHealth(serviceName: string, healthy: boolean, error?: string): void {
    this.serviceHealth.set(serviceName, {
      healthy,
      lastCheck: new Date(),
      responseTime: 0,
      error
    })
  }

  private async healthCheck(serviceName: string, endpoint: ServiceEndpoint): Promise<void> {
    const startTime = Date.now()
    
         try {
       const healthPath = serviceName === 'submission-service' ? '/api/v1/health' : '/health'
       const response = await this.makeRequest(endpoint, healthPath, {
         method: 'GET'
       })

      const responseTime = Date.now() - startTime
      this.serviceHealth.set(serviceName, {
        healthy: true,
        lastCheck: new Date(),
        responseTime,
        error: undefined
      })

      console.log(`Health check passed for ${serviceName} (${responseTime}ms)`)
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.serviceHealth.set(serviceName, {
        healthy: false,
        lastCheck: new Date(),
        responseTime,
        error: (error as Error).message
      })

      console.warn(`Health check failed for ${serviceName}:`, error)
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const endpoints = this.getServiceEndpoints()
      
      for (const [serviceName, endpoint] of Object.entries(endpoints)) {
        await this.healthCheck(serviceName, endpoint)
      }
    }, this.config.healthCheckInterval)
  }

  async callService(
    serviceName: string,
    path: string,
    options: RequestInit = {}
  ): Promise<any> {
    const endpoints = this.getServiceEndpoints()
    const endpoint = endpoints[serviceName]

    if (!endpoint) {
      throw new Error(`Unknown service: ${serviceName}`)
    }

    return this.withRetry(async () => {
      const response = await this.makeRequest(endpoint, path, options)
      return response.json()
    }, serviceName)
  }

  async callSubmissionService(path: string, options: RequestInit = {}): Promise<any> {
    return this.callService('submission-service', path, options)
  }

  async callAIService(path: string, options: RequestInit = {}): Promise<any> {
    return this.callService('ai-service', path, options)
  }

  getServiceHealth(serviceName?: string): ServiceHealth | Map<string, ServiceHealth> {
    if (serviceName) {
      return this.serviceHealth.get(serviceName) || {
        healthy: false,
        lastCheck: new Date(),
        responseTime: 0,
        error: 'Service not found'
      }
    }
    return new Map(this.serviceHealth)
  }

  async testConnectivity(): Promise<{ [key: string]: boolean }> {
    const endpoints = this.getServiceEndpoints()
    const results: { [key: string]: boolean } = {}

         for (const [serviceName, endpoint] of Object.entries(endpoints)) {
       try {
         const healthPath = serviceName === 'submission-service' ? '/api/v1/health' : '/health'
         await this.makeRequest(endpoint, healthPath, { method: 'GET' })
         results[serviceName] = true
       } catch (error) {
         results[serviceName] = false
         console.error(`Connectivity test failed for ${serviceName}:`, error)
       }
     }

    return results
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.circuitBreaker.destroy()
  }
}

// Export singleton instance
export const serviceClient = new ServiceClient()

// Export convenience functions
export const callSubmissionService = (path: string, options?: RequestInit) => 
  serviceClient.callSubmissionService(path, options)

export const callAIService = (path: string, options?: RequestInit) => 
  serviceClient.callAIService(path, options)

export const getServiceHealth = (serviceName?: string) => 
  serviceClient.getServiceHealth(serviceName)

export const testServiceConnectivity = () => 
  serviceClient.testConnectivity() 