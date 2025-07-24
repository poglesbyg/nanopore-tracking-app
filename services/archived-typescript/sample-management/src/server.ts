import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import 'express-async-errors'
import dotenv from 'dotenv'

import { logger } from './utils/logger'
import { initializeDatabase, getDatabase, shutdownDatabase } from './database/connection'
import { SampleRepository } from './repositories/SampleRepository'
import { SampleService } from './services/SampleService'
import { sampleRoutes } from './routes/sample-routes'
import { healthRoutes } from './routes/health-routes'
import { metricsRoutes } from './routes/metrics-routes'
import { errorHandler } from './middleware/error-handler'
import { authMiddleware } from './middleware/auth-middleware'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}))

// Performance middleware
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.headers['x-correlation-id'],
    serviceName: req.headers['x-service-name']
  })
  next()
})

// Health check routes (no auth required)
app.use('/health', healthRoutes)
app.use('/metrics', metricsRoutes)

// Authentication middleware for protected routes
app.use('/api', authMiddleware)

// API routes
app.use('/api/samples', sampleRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  })
})

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase()
    logger.info('Database initialized successfully')

    // Initialize repositories and services
    const database = getDatabase()
    const sampleRepository = new SampleRepository(database)
    const sampleService = new SampleService(sampleRepository)

    // Make services available to routes
    app.locals.sampleService = sampleService

    // Start server
    app.listen(PORT, () => {
      logger.info(`Sample Management Service started on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`)
    })
  } catch (error) {
    logger.error('Failed to start Sample Management Service:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  await shutdownDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  await shutdownDatabase()
  process.exit(0)
})

startServer() 