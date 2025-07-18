import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    correlationId: req.headers['x-correlation-id']
  })

  // Default error response
  let statusCode = 500
  let message = 'Internal Server Error'

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation Error'
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401
    message = 'Unauthorized'
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403
    message = 'Forbidden'
  } else if (error.name === 'NotFoundError') {
    statusCode = 404
    message = 'Not Found'
  }

  res.status(statusCode).json({
    error: message,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    correlationId: req.headers['x-correlation-id']
  })
} 