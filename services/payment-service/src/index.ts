import 'module-alias/register';
import 'dotenv/config';
import { createApp } from './app';
import { PaymentController } from './controllers/PaymentController';
import { connectDatabase, disconnectDatabase } from './config/database';
import env from '@shared/config/env';
import { createLogger } from '@shared/utils/logger';

const logger = createLogger('payment-service');

async function startServer(): Promise<void> {
  let paymentController: PaymentController | null = null;

  try {
    await connectDatabase();


    paymentController = new PaymentController();
    await paymentController.initialize();
    logger.info('RabbitMQ connected successfully');

    const app = createApp();

    const server = app.listen(env.PAYMENT_SERVICE_PORT, () => {
      logger.info(`Payment service started successfully`, {
        port: env.PAYMENT_SERVICE_PORT,
        env: env.NODE_ENV,
        version: '1.0.0',
      });
    });

    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          if (paymentController) {
            await paymentController.disconnect();
            logger.info('RabbitMQ disconnected');
          }

          await disconnectDatabase();

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
    logger.error('Failed to start payment service:', error);

    if (paymentController) {
      try {
        await paymentController.disconnect();
      } catch (cleanupError) {
        logger.error('Error during startup cleanup:', cleanupError);
      }
    }

    process.exit(1);
  }
}

startServer().catch((error: unknown) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
