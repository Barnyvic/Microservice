import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import { createRequestLogger } from '@shared/utils/logger';
import {
  errorHandler,
  notFoundHandler,
} from '@shared/middleware/error-handler';
import productRoutes from './routes';
import env from '@shared/config/env';
import { createLogger } from '@shared/utils/logger';

const logger = createLogger('product-service');

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
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  );

  app.use(createRequestLogger(logger) as any);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'product-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      const database = await import('@shared/config/database');
      const isDbHealthy = database.default.isHealthy();

      if (!isDbHealthy) {
        res.status(503).json({
          status: 'unhealthy',
          service: 'product-service',
          checks: {
            database: { status: 'unhealthy' },
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        status: 'healthy',
        service: 'product-service',
        checks: {
          database: { status: 'healthy' },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'product-service',
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use('/api/v1/products', productRoutes);

  app.use(notFoundHandler as any);

  app.use(errorHandler as any);

  return app;
}

export default createApp;
