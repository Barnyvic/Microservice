import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { ApiError } from '../types';

interface ExtendedRequest extends Request {
  requestId?: string;
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for request validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Conflict error for duplicate resources
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * Service unavailable error for external service failures
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: Record<string, unknown>) {
    super(
      `${service} service is unavailable`,
      503,
      'SERVICE_UNAVAILABLE',
      details
    );
  }
}

/**
 * Convert known errors to AppError instances
 */
function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Handle MongoDB duplicate key errors
    if (
      error.name === 'MongoServerError' &&
      'code' in error &&
      error.code === 11000
    ) {
      return new ConflictError('Resource already exists', {
        error: error.message,
      });
    }

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      return new ValidationError('Validation failed', {
        error: error.message,
      });
    }

    // Handle MongoDB cast errors
    if (error.name === 'CastError') {
      return new ValidationError('Invalid data format', {
        error: error.message,
      });
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      return new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    if (error.name === 'TokenExpiredError') {
      return new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    }

    // Generic error
    return new AppError(
      error.message || 'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }

  // Unknown error type
  return new AppError('Internal server error', 500, 'INTERNAL_ERROR');
}

/**
 * Central error handling middleware
 */
export function errorHandler(
  error: unknown,
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
): void {
  const normalizedError = normalizeError(error);
  const requestId = req.requestId;

  // Log error
  if (normalizedError.statusCode >= 500) {
    logger.error('Server error:', {
      error: normalizedError.message,
      stack: normalizedError.stack,
      requestId,
      url: req.url,
      method: req.method,
    });
  } else {
    logger.warn('Client error:', {
      error: normalizedError.message,
      requestId,
      url: req.url,
      method: req.method,
    });
  }

  // Prepare error response
  const errorResponse: ApiError = {
    code: normalizedError.code,
    message: normalizedError.message,
    requestId,
  };

  // Include details in development mode
  if (process.env.NODE_ENV === 'development' && normalizedError.details) {
    errorResponse.details = normalizedError.details;
  }

  // Don't leak error details in production
  if (
    process.env.NODE_ENV === 'production' &&
    normalizedError.statusCode >= 500
  ) {
    errorResponse.message = 'Internal server error';
  }

  res.status(normalizedError.statusCode).json(errorResponse);
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
): void {
  const error = new NotFoundError('Route', req.path);

  logger.warn('Route not found:', {
    url: req.url,
    method: req.method,
    requestId: req.requestId,
  });

  const errorResponse: ApiError = {
    code: error.code,
    message: error.message,
    requestId: req.requestId,
  };

  res.status(error.statusCode).json(errorResponse);
}

/**
 * Async wrapper to catch async errors in route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
