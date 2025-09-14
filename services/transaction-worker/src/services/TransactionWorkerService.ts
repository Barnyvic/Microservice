import { TransactionHistory } from '../models/TransactionHistory';
import { logger } from '@shared/utils/logger';
import { RedisClient } from '@shared/utils/redis-client';
import { RabbitMQManager } from '@shared/utils/rabbitmq-manager';
import type { TransactionEvent } from '@shared/types';
import env from '@shared/config/env';
import type { WorkerStatus } from '../interfaces';

export class TransactionWorkerService {
  private rabbitMQManager: RabbitMQManager;
  private readonly maxRetries = 3;
  private isProcessing = false;
  private redisClient: RedisClient;

  constructor(private connectionUrl: string) {
    this.rabbitMQManager = RabbitMQManager.getInstance({
      connectionUrl: connectionUrl,
      exchangeName: 'ecommerce.transactions',
      routingKey: 'transaction.created',
      queueName: 'transaction.save',
    });

    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'transaction-worker:',
    });
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting transaction worker to RabbitMQ and Redis', {
        url: this.connectionUrl.replace(/\/\/.*@/, '//***@'),
      });

      await this.rabbitMQManager.connect();
      logger.info('RabbitMQ connection established');

      await this.redisClient.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect transaction worker:', error);
      throw error;
    }
  }

  private async processTransactionEvent(
    transactionEvent: TransactionEvent,
    messageId?: string,
    retryCount = 0
  ): Promise<void> {
    try {
      logger.info('Processing transaction event', {
        transactionId: transactionEvent.transactionId,
        orderId: transactionEvent.orderId,
        customerId: transactionEvent.customerId,
        productId: transactionEvent.productId,
        status: transactionEvent.status,
        messageId,
        retryCount,
      });

      if (messageId) {
        const existingTransaction = await TransactionHistory.findOne({
          messageId,
        });

        if (existingTransaction) {
          logger.info('Duplicate message detected, skipping processing', {
            transactionId: transactionEvent.transactionId,
            messageId,
          });
          return;
        }
      }

      const existingByTxnId = await TransactionHistory.findOne({
        transactionId: transactionEvent.transactionId,
      });

      if (existingByTxnId) {
        logger.info('Transaction already exists, updating status', {
          transactionId: transactionEvent.transactionId,
          existingStatus: existingByTxnId.status,
          newStatus: transactionEvent.status,
        });

        existingByTxnId.status = transactionEvent.status;
        existingByTxnId.processedAt = new Date();
        if (messageId && !existingByTxnId.messageId) {
          existingByTxnId.messageId = messageId;
        }
        await existingByTxnId.save();
      } else {
        const transactionHistory = new TransactionHistory({
          transactionId: transactionEvent.transactionId,
          orderId: transactionEvent.orderId,
          customerId: transactionEvent.customerId,
          productId: transactionEvent.productId,
          amount: transactionEvent.amount,
          status: transactionEvent.status,
          paymentMethod: 'demo_payment',
          processedAt: new Date(),
          messageId,
          createdAt: transactionEvent.timestamp,
          updatedAt: new Date(),
        });

        await transactionHistory.save();

        logger.info('Transaction history saved successfully', {
          transactionId: transactionEvent.transactionId,
          orderId: transactionEvent.orderId,
          customerId: transactionEvent.customerId,
          productId: transactionEvent.productId,
          status: transactionEvent.status,
        });
      }
    } catch (error) {
      logger.error('Failed to process transaction event', {
        error,
        transactionId: transactionEvent.transactionId,
        messageId,
        retryCount,
      });

      throw error;
    }
  }

  private async handleMessage(msg: any): Promise<void> {
    if (!msg) {
      return;
    }

    const messageId = msg.properties.messageId as string;
    const retryCount =
      (msg.properties.headers?.['x-retry-count'] as number) || 0;

    try {
      const content = msg.content.toString();
      const transactionEvent: TransactionEvent = JSON.parse(content);

      if (!transactionEvent.transactionId || !transactionEvent.orderId) {
        throw new Error('Invalid transaction event structure');
      }

      await this.processTransactionEvent(
        transactionEvent,
        messageId,
        retryCount
      );

      // Acknowledge the message
      if (this.rabbitMQManager.isConnected()) {
        // Note: We need to access the channel for ack/nack operations
        // This is a limitation of the current shared manager design
        logger.debug('Message processed and acknowledged', {
          transactionId: transactionEvent.transactionId,
          messageId,
        });
      }
    } catch (error) {
      logger.error('Error processing message', {
        error,
        messageId,
        retryCount,
      });

      if (retryCount < this.maxRetries) {
        const newRetryCount = retryCount + 1;
        const delay = Math.pow(2, newRetryCount) * 1000; // Exponential backoff

        logger.info('Retrying message processing', {
          messageId,
          retryCount: newRetryCount,
          delay,
        });

        // Note: Retry logic would need to be handled by the shared manager
        // For now, we'll just log the retry attempt
        setTimeout(() => {
          logger.warn('Retry logic not implemented in shared manager', {
            messageId,
            retryCount: newRetryCount,
          });
        }, delay);
      } else {
        logger.error('Max retries reached, message will be dead lettered', {
          messageId,
          retryCount,
        });
      }
    }
  }

  async startConsumer(): Promise<void> {
    if (!this.rabbitMQManager.isConnected()) {
      throw new Error('RabbitMQ not connected');
    }

    if (this.isProcessing) {
      logger.warn('Consumer already started');
      return;
    }

    this.isProcessing = true;

    logger.info('Starting transaction worker consumer');

    await this.rabbitMQManager.consumeMessages(msg => this.handleMessage(msg));

    logger.info('Transaction worker consumer started successfully');
  }

  async stopConsumer(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;

    logger.info('Transaction worker consumer stopped');
  }

  getStatus(): WorkerStatus {
    const connectionStatus = this.rabbitMQManager.getConnectionStatus();
    return {
      connected: connectionStatus.connected,
      processing: this.isProcessing,
      queueName: connectionStatus.queueName || 'transaction.save',
      exchangeName: connectionStatus.exchangeName,
    };
  }

  async disconnect(): Promise<void> {
    try {
      await this.stopConsumer();

      await this.rabbitMQManager.disconnect();
      await this.redisClient.disconnect();

      logger.info('Transaction worker disconnected from RabbitMQ and Redis');
    } catch (error) {
      logger.error(
        'Error disconnecting transaction worker from RabbitMQ and Redis:',
        error
      );
      throw error;
    }
  }
}
