import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { WorkflowOrchestrator } from './services/WorkflowOrchestrator'
import { DatabaseService } from './services/DatabaseService'
import { MessageQueueService } from './services/MessageQueueService'
import { RedisService } from './services/RedisService'
import { Logger } from './utils/Logger'
import { HealthCheckService } from './services/HealthCheckService'
import { MetricsService } from './services/MetricsService'
import { setupRoutes } from './routes'
import { errorHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/requestLogger'
import { rateLimiter } from './middleware/rateLimiter'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)

// Environment variables
const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/nanopore_microservices'
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Initialize logger
const logger = new Logger({
  service: 'workflow-orchestrator',
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: NODE_ENV === 'production' ? 'json' : 'text'
})

// Initialize services
const databaseService = new DatabaseService(DATABASE_URL, logger)
const messageQueueService = new MessageQueueService(NATS_URL, logger)
const redisService = new RedisService(REDIS_URL, logger)
const metricsService = new MetricsService(logger)
const healthCheckService = new HealthCheckService({
  database: databaseService,
  messageQueue: messageQueueService,
  redis: redisService
}, logger)

// Initialize workflow orchestrator
const workflowOrchestrator = new WorkflowOrchestrator({
  database: databaseService,
  messageQueue: messageQueueService,
  redis: redisService,
  logger
})

// Middleware
app.use(helmet())
app.use(cors())
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(requestLogger(logger))
app.use(rateLimiter(redisService))

// Routes
app.use('/api/v1', setupRoutes(workflowOrchestrator, healthCheckService, metricsService))

// Error handling
app.use(errorHandler(logger))

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`)
  
  server.close(async () => {
    try {
      await workflowOrchestrator.shutdown()
      await databaseService.disconnect()
      await messageQueueService.disconnect()
      await redisService.disconnect()
      
      logger.info('Shutdown complete')
      process.exit(0)
    } catch (error) {
      logger.error('Error during shutdown:', error)
      process.exit(1)
    }
  })
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Start server
const startServer = async () => {
  try {
    // Initialize services
    await databaseService.connect()
    await messageQueueService.connect()
    await redisService.connect()
    
    // Start workflow orchestrator
    await workflowOrchestrator.start()
    
    // Start health check service
    await healthCheckService.start()
    
    // Start metrics service
    await metricsService.start()
    
    server.listen(PORT, () => {
      logger.info(`Workflow Orchestrator service started on port ${PORT}`)
      logger.info(`Environment: ${NODE_ENV}`)
      logger.info(`Database: ${DATABASE_URL}`)
      logger.info(`Message Queue: ${NATS_URL}`)
      logger.info(`Redis: ${REDIS_URL}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer() 