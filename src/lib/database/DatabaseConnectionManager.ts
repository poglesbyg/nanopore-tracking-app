import { Kysely, PostgresDialect } from 'kysely'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { dbConfig } from '../config'
import { getComponentLogger } from '../logging/StructuredLogger'
import { applicationMetrics } from '../monitoring/MetricsCollector'
import type { Database } from '../database'

const logger = getComponentLogger('DatabaseConnectionManager')

/**
 * Connection pool configuration
 */
export interface DatabasePoolConfig extends PoolConfig {
  // Connection pool settings
  max?: number
  min?: number
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
  acquireTimeoutMillis?: number
  createTimeoutMillis?: number
  
  // Health monitoring
  healthCheckInterval?: number
  healthCheckTimeout?: number
  maxUnhealthyConnections?: number
  
  // Retry logic
  retryAttempts?: number
  retryDelay?: number
  retryBackoffMultiplier?: number
  
  // Query timeout
  queryTimeoutMillis?: number
  
  // Logging
  logSlowQueries?: boolean
  slowQueryThreshold?: number
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingClients: number
  maxConnections: number
  minConnections: number
  totalRequests: number
  totalErrors: number
  averageConnectionTime: number
  averageQueryTime: number
  slowQueries: number
  lastHealthCheck: Date | null
  healthChecksPassed: number
  healthChecksFailed: number
}

/**
 * Database connection health status
 */
export interface ConnectionHealth {
  isHealthy: boolean
  lastChecked: Date
  responseTime: number
  error?: Error
  details: {
    canConnect: boolean
    canQuery: boolean
    connectionCount: number
    memoryUsage: number
  }
}

/**
 * Enhanced database connection manager
 */
export class DatabaseConnectionManager {
  private pool!: Pool
  private kysely!: Kysely<Database>
  private config: DatabasePoolConfig
  private stats: PoolStats
  private healthCheckInterval: NodeJS.Timeout | null = null
  private connectionHealthHistory: ConnectionHealth[] = []
  private retryQueue: Array<{ resolve: Function; reject: Function; query: Function }> = []
  private isShuttingDown = false

  constructor(config: DatabasePoolConfig = {}) {
    this.config = {
      // Default connection pool settings
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 15000,
      createTimeoutMillis: 10000,
      
      // Health monitoring defaults
      healthCheckInterval: 30000, // 30 seconds
      healthCheckTimeout: 5000,
      maxUnhealthyConnections: 3,
      
      // Retry logic defaults
      retryAttempts: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      
      // Query timeout
      queryTimeoutMillis: 30000,
      
      // Logging
      logSlowQueries: true,
      slowQueryThreshold: 1000,
      
      // Override with provided config
      ...config,
      
      // Database connection settings
      connectionString: dbConfig.url,
      statement_timeout: config.queryTimeoutMillis || 30000,
      query_timeout: config.queryTimeoutMillis || 30000
    }

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      maxConnections: this.config.max || 20,
      minConnections: this.config.min || 5,
      totalRequests: 0,
      totalErrors: 0,
      averageConnectionTime: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      lastHealthCheck: null,
      healthChecksPassed: 0,
      healthChecksFailed: 0
    }

    this.initializePool()
    this.startHealthMonitoring()
  }

  /**
   * Initialize the connection pool
   */
  private initializePool(): void {
    this.pool = new Pool(this.config)
    
    // Set up event handlers
    this.pool.on('connect', (client: PoolClient) => {
      this.stats.totalConnections++
      logger.info('Database connection established', {
        totalConnections: this.stats.totalConnections,
        activeConnections: this.pool.totalCount,
        waitingClients: this.pool.waitingCount
      })
    })

    this.pool.on('acquire', (client: PoolClient) => {
      this.stats.activeConnections++
      applicationMetrics.dbConnectionsActive.inc()
    })

    this.pool.on('release', (client: PoolClient) => {
      this.stats.activeConnections--
      applicationMetrics.dbConnectionsActive.dec()
    })

    this.pool.on('remove', (client: PoolClient) => {
      this.stats.totalConnections--
      logger.debug('Database connection removed', {
        totalConnections: this.stats.totalConnections,
        reason: 'connection_removed'
      })
    })

    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.stats.totalErrors++
      logger.error('Database pool error', {
        totalErrors: this.stats.totalErrors,
        errorType: err.name,
        metadata: {
          errorMessage: err.message
        }
      }, err)
      
      applicationMetrics.recordError('database_pool_error', 'DatabaseConnectionManager')
    })

    // Create Kysely instance
    const dialect = new PostgresDialect({
      pool: this.pool
    })

    this.kysely = new Kysely<Database>({
      dialect,
      log: (event) => {
        const duration = event.queryDurationMillis || 0
        
        if (event.level === 'query') {
          this.stats.totalRequests++
          this.stats.averageQueryTime = 
            (this.stats.averageQueryTime * (this.stats.totalRequests - 1) + duration) / this.stats.totalRequests
          
          if (duration > (this.config.slowQueryThreshold || 1000)) {
            this.stats.slowQueries++
            
            if (this.config.logSlowQueries) {
              logger.warn('Slow database query detected', {
                duration,
                sql: event.query.sql,
                metadata: {
                  parameters: event.query.parameters,
                  slowQueryThreshold: this.config.slowQueryThreshold
                }
              })
            }
          }
          
          // Record metrics
          applicationMetrics.recordDatabaseQuery(
            this.extractOperation(event.query.sql),
            this.extractTable(event.query.sql),
            duration / 1000 // Convert to seconds
          )
        }
        
        if (event.level === 'error') {
          this.stats.totalErrors++
          logger.error('Database query error', {
            sql: event.query.sql,
            errorType: 'query_error',
            metadata: {
              parameters: event.query.parameters,
              error: event.error
            }
          })
          
          applicationMetrics.recordError('database_query_error', 'DatabaseConnectionManager')
        }
      }
    })
  }

  /**
   * Extract operation type from SQL query
   */
  private extractOperation(sql: string): string {
    const match = sql.trim().match(/^(\w+)/i)
    return match ? match[1].toLowerCase() : 'unknown'
  }

  /**
   * Extract table name from SQL query
   */
  private extractTable(sql: string): string {
    const selectMatch = sql.match(/from\s+["`']?(\w+)["`']?/i)
    const insertMatch = sql.match(/insert\s+into\s+["`']?(\w+)["`']?/i)
    const updateMatch = sql.match(/update\s+["`']?(\w+)["`']?/i)
    const deleteMatch = sql.match(/delete\s+from\s+["`']?(\w+)["`']?/i)
    
    const match = selectMatch || insertMatch || updateMatch || deleteMatch
    return match ? match[1] : 'unknown'
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
      this.healthCheckInterval = setInterval(async () => {
        await this.performHealthCheck()
      }, this.config.healthCheckInterval)
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<ConnectionHealth> {
    const startTime = Date.now()
    let health: ConnectionHealth = {
      isHealthy: false,
      lastChecked: new Date(),
      responseTime: 0,
      details: {
        canConnect: false,
        canQuery: false,
        connectionCount: this.pool.totalCount,
        memoryUsage: process.memoryUsage().heapUsed
      }
    }

    try {
      // Test basic connectivity
      const client = await this.pool.connect()
      health.details.canConnect = true
      
      // Test query capability
      const result = await client.query('SELECT 1 as health_check')
      health.details.canQuery = result.rows.length > 0
      
      client.release()
      
      health.isHealthy = health.details.canConnect && health.details.canQuery
      health.responseTime = Date.now() - startTime
      
      if (health.isHealthy) {
        this.stats.healthChecksPassed++
        this.stats.lastHealthCheck = new Date()
        
        logger.debug('Database health check passed', {
          responseTime: health.responseTime,
          connectionCount: health.details.connectionCount,
          totalHealthChecks: this.stats.healthChecksPassed + this.stats.healthChecksFailed
        })
      } else {
        this.stats.healthChecksFailed++
        logger.warn('Database health check failed', {
          responseTime: health.responseTime,
          canConnect: health.details.canConnect,
          canQuery: health.details.canQuery,
          metadata: {
            connectionCount: health.details.connectionCount
          }
        })
      }
      
    } catch (error) {
      this.stats.healthChecksFailed++
      health.error = error instanceof Error ? error : new Error('Unknown health check error')
      health.responseTime = Date.now() - startTime
      
      logger.error('Database health check error', {
        responseTime: health.responseTime,
        errorType: error instanceof Error ? error.name : 'Unknown',
        metadata: {
          connectionCount: health.details.connectionCount
        }
      }, error instanceof Error ? error : undefined)
      
      applicationMetrics.recordError('database_health_check_error', 'DatabaseConnectionManager')
    }

    // Update connection health history
    this.connectionHealthHistory.push(health)
    
    // Keep only last 100 health checks
    if (this.connectionHealthHistory.length > 100) {
      this.connectionHealthHistory.shift()
    }

    return health
  }

  /**
   * Execute query with retry logic
   */
  public async executeWithRetry<T>(
    queryFn: (kysely: Kysely<Database>) => Promise<T>,
    operation: string = 'query'
  ): Promise<T> {
    let lastError: Error | null = null
    let delay = this.config.retryDelay || 1000
    
    for (let attempt = 1; attempt <= (this.config.retryAttempts || 3); attempt++) {
      try {
        logger.debug(`Executing database operation`, {
          operation,
          attempt,
          maxAttempts: this.config.retryAttempts || 3
        })
        
        const result = await queryFn(this.kysely)
        
        if (attempt > 1) {
          logger.info('Database operation succeeded after retry', {
            operation,
            attempt,
            totalAttempts: attempt
          })
        }
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown database error')
        
        if (attempt === (this.config.retryAttempts || 3)) {
          logger.error('Database operation failed after all retries', {
            operation,
            attempt,
            maxAttempts: this.config.retryAttempts || 3,
            errorType: lastError.name,
            metadata: {
              errorMessage: lastError.message
            }
          }, lastError)
          
          applicationMetrics.recordError('database_operation_failed', 'DatabaseConnectionManager')
          break
        }
        
        logger.warn('Database operation failed, retrying', {
          operation,
          attempt,
          maxAttempts: this.config.retryAttempts || 3,
          delay,
          errorType: lastError.name
        })
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= this.config.retryBackoffMultiplier || 2
      }
    }
    
    throw lastError || new Error('Database operation failed after retries')
  }

  /**
   * Get database instance
   */
  public getDatabase(): Kysely<Database> {
    return this.kysely
  }

  /**
   * Get pool statistics
   */
  public getStats(): PoolStats {
    return {
      ...this.stats,
      activeConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    }
  }

  /**
   * Get connection health
   */
  public getConnectionHealth(): ConnectionHealth | null {
    return this.connectionHealthHistory.length > 0 
      ? this.connectionHealthHistory[this.connectionHealthHistory.length - 1]
      : null
  }

  /**
   * Get connection health history
   */
  public getConnectionHealthHistory(): ConnectionHealth[] {
    return [...this.connectionHealthHistory]
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      await this.executeWithRetry(async (db) => {
        await db.selectFrom('nanopore_samples').select('id').limit(1).execute()
      }, 'connection_test')
      return true
    } catch (error) {
      logger.error('Database connection test failed', {
        errorType: error instanceof Error ? error.name : 'Unknown'
      }, error instanceof Error ? error : undefined)
      return false
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }
    
    this.isShuttingDown = true
    
    logger.info('Shutting down database connection manager')
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    // Close all connections
    try {
      await this.pool.end()
      logger.info('Database connection pool closed successfully')
    } catch (error) {
      logger.error('Error closing database connection pool', {
        errorType: error instanceof Error ? error.name : 'Unknown'
      }, error instanceof Error ? error : undefined)
    }
  }
}

/**
 * Default database connection manager instance
 */
export const databaseManager = new DatabaseConnectionManager({
  max: dbConfig.maxConnections || 20,
  min: 5,
  idleTimeoutMillis: dbConfig.idleTimeout || 30000,
  connectionTimeoutMillis: dbConfig.connectionTimeout || 10000,
  healthCheckInterval: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  queryTimeoutMillis: 30000,
  logSlowQueries: true,
  slowQueryThreshold: 1000
})

/**
 * Get the managed database instance
 */
export function getDatabase(): Kysely<Database> {
  return databaseManager.getDatabase()
}

/**
 * Execute database operation with retry logic
 */
export async function executeWithRetry<T>(
  queryFn: (kysely: Kysely<Database>) => Promise<T>,
  operation?: string
): Promise<T> {
  return databaseManager.executeWithRetry(queryFn, operation)
}

/**
 * Get database connection statistics
 */
export function getDatabaseStats(): PoolStats {
  return databaseManager.getStats()
}

/**
 * Get database connection health
 */
export function getDatabaseHealth(): ConnectionHealth | null {
  return databaseManager.getConnectionHealth()
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  return databaseManager.testConnection()
}

/**
 * Graceful shutdown handler
 */
export async function shutdownDatabase(): Promise<void> {
  await databaseManager.shutdown()
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down database connections')
  await shutdownDatabase()
})

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down database connections')
  await shutdownDatabase()
}) 