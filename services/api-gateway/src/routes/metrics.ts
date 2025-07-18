import { Router } from 'express'
import { serviceRegistry } from '../services/service-registry'

export const metricsRouter = Router()

// Basic metrics endpoint
metricsRouter.get('/', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    services: serviceRegistry.getHealthyServices()
  }

  res.json(metrics)
})

// Prometheus-style metrics
metricsRouter.get('/prometheus', (req, res) => {
  const services = serviceRegistry.getServices()
  const healthyCount = Object.values(services).filter(s => s.isHealthy).length
  const totalCount = Object.values(services).length

  const prometheusMetrics = `
# HELP gateway_uptime_seconds Gateway uptime in seconds
# TYPE gateway_uptime_seconds counter
gateway_uptime_seconds ${process.uptime()}

# HELP gateway_memory_usage_bytes Memory usage in bytes
# TYPE gateway_memory_usage_bytes gauge
gateway_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
gateway_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}
gateway_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}

# HELP gateway_services_total Total number of services
# TYPE gateway_services_total gauge
gateway_services_total ${totalCount}

# HELP gateway_services_healthy Number of healthy services
# TYPE gateway_services_healthy gauge
gateway_services_healthy ${healthyCount}
`.trim()

  res.set('Content-Type', 'text/plain')
  res.send(prometheusMetrics)
}) 