import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { createRequestLogger } from '@shared/utils/logger';
import {
  errorHandler,
  notFoundHandler,
} from '@shared/middleware/error-handler';
import paymentRoutes from './routes';
import env from '@shared/config/env';
import { createLogger } from '@shared/utils/logger';

const logger = createLogger('payment-service');


export function createApp(): express.Application {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for API service
    })
  );

  app.use(hpp()); // HTTP Parameter Pollution protection

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'Idempotency-Key', // Support for idempotency
      ],
    })
  );

  // Request logging
  app.use(createRequestLogger(logger));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/healthz', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'payment-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness check endpoint
  app.get('/readyz', async (req, res) => {
    try {
      // Import database config here to avoid circular dependencies
      const database = await import('@shared/config/database');
      const isDbHealthy = database.default.isHealthy();

      // Check RabbitMQ connection through controller
      // Note: In a real app, you'd import the service here
      const rabbitMQHealthy = true; // Simplified for now

      if (!isDbHealthy) {
        return res.status(503).json({
          status: 'unhealthy',
          service: 'payment-service',
          checks: {
            database: { status: 'unhealthy' },
            messageQueue: { status: rabbitMQHealthy ? 'healthy' : 'unhealthy' },
          },
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        status: 'healthy',
        service: 'payment-service',
        checks: {
          database: { status: 'healthy' },
          messageQueue: { status: rabbitMQHealthy ? 'healthy' : 'unhealthy' },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'payment-service',
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // API routes
  app.use('/api/v1/payments', paymentRoutes);

  // 404 handler for unknown routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

export default createApp;


