import { Router } from 'express'
import { serviceRegistry } from '../services/service-registry'
import { logger } from '../utils/logger'

export const healthRouter = Router()

// Gateway health check
healthRouter.get('/', async (req, res) => {
  try {
    const healthStatus = {
      service: 'api-gateway',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    }

    res.json(healthStatus)
  } catch (error) {
    logger.error('Health check failed', error)
    res.status(500).json({
      service: 'api-gateway',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Services health check
healthRouter.get('/services', async (req, res) => {
  try {
    await serviceRegistry.performHealthChecks()
    const services = serviceRegistry.getServices()
    const healthyServices = serviceRegistry.getHealthyServices()

    const serviceHealth = Object.entries(services).map(([name, config]) => ({
      name,
      url: config.url,
      isHealthy: config.isHealthy,
      lastHealthCheck: config.lastHealthCheck
    }))

    res.json({
      timestamp: new Date().toISOString(),
      totalServices: Object.keys(services).length,
      healthyServices: Object.keys(healthyServices).length,
      services: serviceHealth
    })
  } catch (error) {
    logger.error('Services health check failed', error)
    res.status(500).json({
      error: 'Services health check failed',
      timestamp: new Date().toISOString()
    })
  }
})

// Readiness check
healthRouter.get('/ready', async (req, res) => {
  try {
    const healthyServices = serviceRegistry.getHealthyServices()
    const criticalServices = ['sample-management', 'authentication']
    
    const criticalServicesHealthy = criticalServices.every(
      service => healthyServices[service]
    )

    if (criticalServicesHealthy) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        criticalServices: criticalServices.filter(s => healthyServices[s])
      })
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        missingServices: criticalServices.filter(s => !healthyServices[s])
      })
    }
  } catch (error) {
    logger.error('Readiness check failed', error)
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Liveness check
healthRouter.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}) 