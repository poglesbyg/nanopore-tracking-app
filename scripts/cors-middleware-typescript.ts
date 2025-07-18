/**
 * Standardized CORS middleware for TypeScript/Node.js services.
 * This module provides a consistent CORS configuration across all TypeScript microservices.
 */

import { Request, Response, NextFunction } from 'express';

export interface CorsOptions {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Get CORS origins from environment variable with fallback defaults.
 */
export function getCorsOrigins(): string[] {
  const origins = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001';
  return origins.split(',').map(origin => origin.trim());
}

/**
 * Get CORS methods from environment variable with fallback defaults.
 */
export function getCorsMethods(): string[] {
  const methods = process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS,PATCH';
  return methods.split(',').map(method => method.trim());
}

/**
 * Get CORS headers from environment variable with fallback defaults.
 */
export function getCorsHeaders(): string[] {
  const headers = process.env.CORS_HEADERS || 'Content-Type,Authorization,X-Requested-With,Accept,Origin';
  return headers.split(',').map(header => header.trim());
}

/**
 * Get CORS credentials setting from environment variable.
 */
export function getCorsCredentials(): boolean {
  return (process.env.CORS_CREDENTIALS || 'true').toLowerCase() === 'true';
}

/**
 * Get CORS max age from environment variable.
 */
export function getCorsMaxAge(): number {
  return parseInt(process.env.CORS_MAX_AGE || '86400', 10);
}

/**
 * Create standardized CORS middleware for Express applications.
 */
export function createCorsMiddleware(options: CorsOptions = {}) {
  const corsOrigins = options.origins || getCorsOrigins();
  const corsMethods = options.methods || getCorsMethods();
  const corsHeaders = options.headers || getCorsHeaders();
  const corsCredentials = options.credentials !== undefined ? options.credentials : getCorsCredentials();
  const corsMaxAge = options.maxAge || getCorsMaxAge();

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && corsOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (corsOrigins.includes('*')) {
      res.header('Access-Control-Allow-Origin', '*');
    }

    // Set other CORS headers
    res.header('Access-Control-Allow-Methods', corsMethods.join(', '));
    res.header('Access-Control-Allow-Headers', corsHeaders.join(', '));
    res.header('Access-Control-Max-Age', corsMaxAge.toString());

    if (corsCredentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };
}

/**
 * Validate CORS configuration and return current settings.
 */
export function validateCorsConfig(): CorsOptions & { valid: boolean; errors: string[] } {
  const config = {
    origins: getCorsOrigins(),
    methods: getCorsMethods(),
    headers: getCorsHeaders(),
    credentials: getCorsCredentials(),
    maxAge: getCorsMaxAge(),
  };

  const errors: string[] = [];

  // Basic validation
  if (!config.origins || config.origins.length === 0) {
    errors.push('CORS_ORIGINS cannot be empty');
  }

  if (!config.methods || config.methods.length === 0) {
    errors.push('CORS_METHODS cannot be empty');
  }

  return {
    ...config,
    valid: errors.length === 0,
    errors,
  };
}

// Example usage:
// import { createCorsMiddleware } from './cors-middleware';
// 
// const app = express();
// app.use(createCorsMiddleware()); 