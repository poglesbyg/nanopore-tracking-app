import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip auth for health checks and public endpoints
    if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
      return next()
    }

    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization header provided'
      })
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      })
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
    
    try {
      const decoded = jwt.verify(token, jwtSecret) as any
      req.user = {
        id: decoded.id || decoded.sub,
        email: decoded.email,
        role: decoded.role || 'user'
      }

      // Add user context to logs
      logger.info('User authenticated', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        path: req.path
      })

      next()
    } catch (jwtError) {
      logger.warn('JWT verification failed', {
        error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
        token: token.substring(0, 10) + '...'
      })

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      })
    }
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path
    })

    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    })
  }
}

export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      })
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Required role: ${requiredRole}`
      })
    }

    next()
  }
} 