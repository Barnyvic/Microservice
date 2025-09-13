import 'module-alias/register';
import 'dotenv/config';
import { createApp } from './app';
import database from '@shared/config/database';
import env from '@shared/config/env';
import { createLogger } from '@shared/utils/logger';
import { ProductService } from './services/ProductService';

const logger = createLogger('product-service');
const productService = new ProductService();

async function startServer(): Promise<void> {
  try {
    await database.connect(env.MONGODB_URI);
    logger.info('Database connected successfully');

    await productService.initialize();
    logger.info('Redis connected successfully');

    const app = createApp();

    const server = app.listen(env.PRODUCT_SERVICE_PORT, () => {
      logger.info(`Product service started successfully`, {
        port: env.PRODUCT_SERVICE_PORT,
        env: env.NODE_ENV,
        version: '1.0.0',
      });
    });

    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await productService.disconnect();
          logger.info('Redis disconnected');

          await database.disconnect();
          logger.info('Database disconnected');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown after 30 seconds');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled promise rejection:', reason);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start product service:', error);
    process.exit(1);
  }
}

startServer().catch((error: unknown) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
