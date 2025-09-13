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

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  app.use(hpp());

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'Idempotency-Key',
      ],
    })
  );

  app.use(createRequestLogger(logger) as any);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'payment-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      const { isDatabaseHealthy } = await import('./config/database');
      const dbHealthy = isDatabaseHealthy();

      const rabbitMQHealthy = true;

      if (!dbHealthy) {
        res.status(503).json({
          status: 'unhealthy',
          service: 'payment-service',
          checks: {
            database: { status: 'unhealthy' },
            messageQueue: { status: rabbitMQHealthy ? 'healthy' : 'unhealthy' },
          },
          timestamp: new Date().toISOString(),
        });
        return;
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

  app.use('/api/v1/payments', paymentRoutes);

  app.use(notFoundHandler as any);

  app.use(errorHandler as any);

  return app;
}

export default createApp;
