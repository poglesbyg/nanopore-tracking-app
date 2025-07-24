import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import 'express-async-errors'
import dotenv from 'dotenv'

import { logger } from './utils/logger'
import { serviceRegistry } from './services/service-registry'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import { healthRouter } from './routes/health'
import { proxyRouter } from './routes/proxy'
import { metricsRouter } from './routes/metrics'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3007',
  credentials: true
}))

// Performance middleware
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    correlationId: req.headers['x-correlation-id']
  })
  next()
})

// Health check routes (no auth required)
app.use('/health', healthRouter)
app.use('/metrics', metricsRouter)

// Authentication middleware for protected routes
app.use('/api', authMiddleware)

// Service proxy routes
app.use('/api', proxyRouter)

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
    // Initialize service registry
    await serviceRegistry.initialize()
    
    // Start periodic health checks
    serviceRegistry.startHealthChecks()

    app.listen(PORT, () => {
      logger.info(`API Gateway started on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info('Available services:', serviceRegistry.getServices())
    })
  } catch (error) {
    logger.error('Failed to start API Gateway:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  await serviceRegistry.shutdown()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  await serviceRegistry.shutdown()
  process.exit(0)
})

startServer() 