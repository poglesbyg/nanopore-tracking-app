import type { APIRoute } from 'astro'
import { applicationMetrics } from '../lib/monitoring/MetricsCollector'
import { getComponentLogger } from '../lib/logging/StructuredLogger'
import { db } from '../lib/database'

const logger = getComponentLogger('HealthCheck')

/**
 * Health check status levels
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Health check for individual components
 */
interface ComponentHealth {
  status: HealthStatus
  message?: string
  responseTime?: number
  details?: Record<string, any>
}

/**
 * Overall health check response
 */
interface HealthResponse {
  status: HealthStatus
  timestamp: string
  service: string
  version: string
  uptime: number
  environment: string
  components: {
    database: ComponentHealth
    memory: ComponentHealth
    system: ComponentHealth
  }
  metrics: {
    memoryUsage: {
      heapUsed: number
      heapTotal: number
      external: number
      rss: number
    }
    cpuUsage: number
    activeConnections: number
    requestsPerSecond: number
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  try {
    const start = Date.now()
    
    // Simple database connectivity check
    await db.selectFrom('nanopore_samples')
      .select('id')
      .limit(1)
      .execute()
    
    const responseTime = Date.now() - start
    
    return {
      status: 'healthy',
      message: 'Database connection successful',
      responseTime,
      details: {
        connected: true,
        type: 'postgresql'
      }
    }
  } catch (error) {
    logger.error('Database health check failed', {
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        component: 'database'
      }
    }, error instanceof Error ? error : undefined)
    
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      details: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Check memory health
 */
function checkMemoryHealth(): ComponentHealth {
  const memUsage = process.memoryUsage()
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
  const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  
  let status: HealthStatus = 'healthy'
  let message = `Memory usage: ${heapUsedMB}MB/${heapTotalMB}MB (${heapUsagePercent}%)`
  
  if (heapUsagePercent > 90) {
    status = 'unhealthy'
    message = `Critical memory usage: ${heapUsagePercent}%`
  } else if (heapUsagePercent > 75) {
    status = 'degraded'
    message = `High memory usage: ${heapUsagePercent}%`
  }
  
  return {
    status,
    message,
    details: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      usagePercent: heapUsagePercent
    }
  }
}

/**
 * Check system health
 */
function checkSystemHealth(): ComponentHealth {
  const uptime = process.uptime()
  const uptimeHours = Math.floor(uptime / 3600)
  
  return {
    status: 'healthy',
    message: `System running for ${uptimeHours} hours`,
    details: {
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    }
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(components: HealthResponse['components']): HealthStatus {
  const statuses = Object.values(components).map(c => c.status)
  
  if (statuses.includes('unhealthy')) {
    return 'unhealthy'
  }
  
  if (statuses.includes('degraded')) {
    return 'degraded'
  }
  
  return 'healthy'
}

export const GET: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  
  try {
    // Check all components
    const [databaseHealth, memoryHealth, systemHealth] = await Promise.all([
      checkDatabaseHealth(),
      Promise.resolve(checkMemoryHealth()),
      Promise.resolve(checkSystemHealth())
    ])
    
    const components = {
      database: databaseHealth,
      memory: memoryHealth,
      system: systemHealth
    }
    
    // Determine overall status
    const overallStatus = determineOverallStatus(components)
    
    // Get current metrics
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    const health: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'nanopore-tracking-app',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      components,
      metrics: {
        memoryUsage: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        },
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
        activeConnections: 0, // TODO: Implement active connection tracking
        requestsPerSecond: 0 // TODO: Implement RPS calculation
      }
    }
    
    const duration = (Date.now() - startTime) / 1000
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
    
    // Record metrics
    applicationMetrics.recordHttpRequest('GET', '/health', statusCode, duration)
    
    logger.info('Health check completed', {
      duration,
      userAgent: request.headers.get('User-Agent') || 'Unknown',
      metadata: {
        overallStatus,
        components: Object.fromEntries(
          Object.entries(components).map(([key, value]) => [key, value.status])
        )
      }
    })
    
    return new Response(JSON.stringify(health, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000
    
    logger.error('Health check failed', {
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        userAgent: request.headers.get('User-Agent') || 'Unknown'
      }
    }, error instanceof Error ? error : undefined)
    
    applicationMetrics.recordError('health_check_error', 'health_endpoint')
    applicationMetrics.recordHttpRequest('GET', '/health', 503, duration)
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
} 