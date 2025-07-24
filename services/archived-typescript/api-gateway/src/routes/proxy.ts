import { Router } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { serviceRegistry } from '../services/service-registry'
import { logger } from '../utils/logger'

export const proxyRouter = Router()

// Service routing configuration
const serviceRoutes = {
  '/samples': 'sample-management',
  '/ai': 'ai-processing',
  '/auth': 'authentication',
  '/files': 'file-storage',
  '/audit': 'audit',
  '/submission': 'submission-service'
}

// Create proxy middleware for each service
Object.entries(serviceRoutes).forEach(([path, serviceName]) => {
  proxyRouter.use(path, createProxyMiddleware({
    target: `http://${serviceName}:${getServicePort(serviceName)}`,
    changeOrigin: true,
    pathRewrite: {
      [`^/api${path}`]: ''
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add correlation ID for tracing
      const correlationId = req.headers['x-correlation-id'] || 
                          `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      proxyReq.setHeader('x-correlation-id', correlationId)
      
      // Add service context
      proxyReq.setHeader('x-service-name', serviceName)
      proxyReq.setHeader('x-gateway-version', '1.0.0')
      
      logger.info(`Proxying request to ${serviceName}`, {
        path: req.path,
        method: req.method,
        correlationId,
        target: proxyReq.path
      })
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add response headers
      proxyRes.headers['x-served-by'] = serviceName
      proxyRes.headers['x-gateway-timestamp'] = new Date().toISOString()
      
      logger.info(`Response from ${serviceName}`, {
        path: req.path,
        status: proxyRes.statusCode,
        correlationId: req.headers['x-correlation-id']
      })
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}`, {
        error: err.message,
        path: req.path,
        method: req.method
      })
      
      res.status(503).json({
        error: 'Service Unavailable',
        message: `${serviceName} is currently unavailable`,
        timestamp: new Date().toISOString()
      })
    },
    router: (req) => {
      // Dynamic routing based on service health
      const service = serviceRegistry.getHealthyService(serviceName)
      if (service) {
        return service.url
      }
      
      logger.warn(`Service ${serviceName} is not healthy, request will fail`)
      return null
    }
  }))
})

function getServicePort(serviceName: string): number {
  const portMap: Record<string, number> = {
    'sample-management': 3002,
    'ai-processing': 3003,
    'authentication': 3004,
    'file-storage': 3005,
    'audit': 3006,
    'submission-service': 8000
  }
  return portMap[serviceName] || 3000
}

// Fallback for unknown routes
proxyRouter.use('*', (req, res) => {
  logger.warn(`Unknown route accessed: ${req.path}`)
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.path} not found in any service`,
    availableRoutes: Object.keys(serviceRoutes),
    timestamp: new Date().toISOString()
  })
}) 