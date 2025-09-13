import 'module-alias/register';
import 'dotenv/config';
import { TransactionWorkerService } from './services/TransactionWorkerService';
import database from '@shared/config/database';
import env from '@shared/config/env';
import { createLogger } from '@shared/utils/logger';

const logger = createLogger('transaction-worker');

async function startWorker(): Promise<void> {
  let workerService: TransactionWorkerService | null = null;

  try {
    await database.connect(env.MONGODB_URI);
    logger.info('Database connected successfully');

    workerService = new TransactionWorkerService(env.RABBITMQ_URI!);
    await workerService.connect();
    logger.info('RabbitMQ connected successfully');

    await workerService.startConsumer();
    logger.info('Transaction worker started successfully', {
      env: env.NODE_ENV,
      version: '1.0.0',
    });

    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        if (workerService) {
          await workerService.stopConsumer();
          logger.info('Message consumption stopped');

          await new Promise(resolve => setTimeout(resolve, 5000));

          await workerService.disconnect();
          logger.info('RabbitMQ disconnected');
        }

        await database.disconnect();
        logger.info('Database disconnected');

        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
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

    logger.info('Transaction worker is running and listening for messages...');
  } catch (error) {
    logger.error('Failed to start transaction worker:', error);

    if (workerService) {
      try {
        await workerService.disconnect();
      } catch (cleanupError) {
        logger.error('Error during startup cleanup:', cleanupError);
      }
    }

    process.exit(1);
  }
}

startWorker().catch((error: unknown) => {
  logger.error('Failed to start transaction worker:', error);
  process.exit(1);
});
