import { logger } from '../utils/logger'

export interface ServiceConfig {
  name: string
  url: string
  port: number
  healthPath: string
  timeout: number
  retries: number
  isHealthy: boolean
  lastHealthCheck: Date | null
}

class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  async initialize() {
    // Load service configurations from environment
    this.loadServiceConfigurations()
    
    // Perform initial health checks
    await this.performHealthChecks()
    
    logger.info('Service registry initialized', {
      serviceCount: this.services.size,
      services: Array.from(this.services.keys())
    })
  }

  private loadServiceConfigurations() {
    const services = [
      {
        name: 'sample-management',
        url: process.env.SAMPLE_SERVICE_URL || 'http://sample-management:3002',
        port: 3002,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        isHealthy: false,
        lastHealthCheck: null
      },
      {
        name: 'ai-processing',
        url: process.env.AI_SERVICE_URL || 'http://ai-processing:3003',
        port: 3003,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        isHealthy: false,
        lastHealthCheck: null
      },
      {
        name: 'authentication',
        url: process.env.AUTH_SERVICE_URL || 'http://authentication:3004',
        port: 3004,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        isHealthy: false,
        lastHealthCheck: null
      },
      {
        name: 'file-storage',
        url: process.env.FILE_SERVICE_URL || 'http://file-storage:3005',
        port: 3005,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        isHealthy: false,
        lastHealthCheck: null
      },
      {
        name: 'audit',
        url: process.env.AUDIT_SERVICE_URL || 'http://audit:3006',
        port: 3006,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        isHealthy: false,
        lastHealthCheck: null
      },
      {
        name: 'submission-service',
        url: process.env.SUBMISSION_SERVICE_URL || 'http://submission-service:8000',
        port: 8000,
        healthPath: '/health',
        timeout: 5000,
        retries: 3,
        isHealthy: false,
        lastHealthCheck: null
      }
    ]

    services.forEach(service => {
      this.services.set(service.name, service)
    })
  }

  async performHealthChecks() {
    const healthCheckPromises = Array.from(this.services.values()).map(
      service => this.checkServiceHealth(service)
    )
    
    await Promise.allSettled(healthCheckPromises)
  }

  private async checkServiceHealth(service: ServiceConfig): Promise<void> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), service.timeout)

      const response = await fetch(`${service.url}${service.healthPath}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      service.isHealthy = response.ok
      service.lastHealthCheck = new Date()

      if (response.ok) {
        logger.debug(`Service ${service.name} is healthy`)
      } else {
        logger.warn(`Service ${service.name} health check failed`, {
          status: response.status,
          statusText: response.statusText
        })
      }
    } catch (error) {
      service.isHealthy = false
      service.lastHealthCheck = new Date()
      
      logger.error(`Service ${service.name} health check failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  getService(name: string): ServiceConfig | undefined {
    return this.services.get(name)
  }

  getHealthyService(name: string): ServiceConfig | undefined {
    const service = this.services.get(name)
    return service && service.isHealthy ? service : undefined
  }

  getServices(): Record<string, ServiceConfig> {
    return Object.fromEntries(this.services)
  }

  getHealthyServices(): Record<string, ServiceConfig> {
    const healthyServices = new Map()
    
    this.services.forEach((service, name) => {
      if (service.isHealthy) {
        healthyServices.set(name, service)
      }
    })
    
    return Object.fromEntries(healthyServices)
  }

  startHealthChecks() {
    // Perform health checks every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks()
    }, 30000)
    
    logger.info('Health check monitoring started')
  }

  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    logger.info('Service registry shutdown completed')
  }
}

export const serviceRegistry = new ServiceRegistry() 