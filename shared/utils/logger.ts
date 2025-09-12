import winston from 'winston';
import type { Request, Response, NextFunction } from 'express';

interface LogMeta {
  service?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

interface ExtendedRequest extends Request {
  requestId?: string;
}

/**
 * Create a winston logger instance with proper formatting
 */
function createLogger(service = 'unknown'): winston.Logger {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({
        timestamp,
        level,
        message,
        service: svc,
        requestId,
        userId,
        ...meta
      }: winston.Logform.TransformableInfo & LogMeta) => {
        const metaStr =
          Object.keys(meta).length > 0
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';

        const contextStr = [
          svc || service,
          requestId && `req:${requestId}`,
          userId && `user:${userId}`,
        ]
          .filter(Boolean)
          .join(' | ');

        return `[${timestamp}] ${level.toUpperCase()} [${contextStr}]: ${message}${metaStr}`;
      }
    )
  );

  // Console transport for development
  const consoleTransport = new winston.transports.Console({
    level: logLevel,
    format:
      nodeEnv === 'production'
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        : logFormat,
  });

  const logger = winston.createLogger({
    level: logLevel,
    defaultMeta: { service },
    transports: [consoleTransport],
    exitOnError: false,
  });

  // Handle uncaught exceptions and rejections
  logger.exceptions.handle(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );

  logger.rejections.handle(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );

  return logger;
}

/**
 * Create request logger middleware
 */
function createRequestLogger(
  logger: winston.Logger
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId =
      (req.headers['x-request-id'] as string) ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Attach request ID to request object
    req.requestId = requestId;

    // Set response header
    res.setHeader('X-Request-Id', requestId);

    // Log request
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk?: unknown, encoding?: BufferEncoding) {
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId,
      });

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

// Default logger instance
const defaultLogger = createLogger();

export {
  createLogger,
  createRequestLogger,
  defaultLogger as logger,
};

// For backward compatibility
export const info = defaultLogger.info.bind(defaultLogger);
export const warn = defaultLogger.warn.bind(defaultLogger);
export const error = defaultLogger.error.bind(defaultLogger);
export const debug = defaultLogger.debug.bind(defaultLogger);
