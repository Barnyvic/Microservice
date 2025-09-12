import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import type { ApiError } from '../types';

interface ExtendedRequest extends Request {
  requestId?: string;
}

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

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
  }
}

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

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    if (
      error.name === 'MongoServerError' &&
      'code' in error &&
      error.code === 11000
    ) {
      return new ConflictError('Resource already exists', {
        error: error.message,
      });
    }

    if (error.name === 'ValidationError') {
      return new ValidationError('Validation failed', {
        error: error.message,
      });
    }

    if (error.name === 'CastError') {
      return new ValidationError('Invalid data format', {
        error: error.message,
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    if (error.name === 'TokenExpiredError') {
      return new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    }

    return new AppError(
      error.message || 'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }

  return new AppError('Internal server error', 500, 'INTERNAL_ERROR');
}

export function errorHandler(
  error: unknown,
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
): void {
  const normalizedError = normalizeError(error);
  const requestId = req.requestId;

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

  const errorResponse: ApiError = {
    code: normalizedError.code,
    message: normalizedError.message,
    requestId,
  };

  if (process.env.NODE_ENV === 'development' && normalizedError.details) {
    errorResponse.details = normalizedError.details;
  }

  if (
    process.env.NODE_ENV === 'production' &&
    normalizedError.statusCode >= 500
  ) {
    errorResponse.message = 'Internal server error';
  }

  res.status(normalizedError.statusCode).json(errorResponse);
}

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

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

