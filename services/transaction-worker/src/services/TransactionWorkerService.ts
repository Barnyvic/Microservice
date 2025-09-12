import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { TransactionHistory } from '../models/TransactionHistory';
import { logger } from '@shared/utils/logger';
import { RedisClient } from '@shared/utils/redis-client';
import { CacheManager } from '@shared/utils/cache-manager';
import type { TransactionEvent } from '@shared/types';
import env from '@shared/config/env';
import type {
  WorkerStatus,
  MessageProcessingResult,
  WorkerConfig,
  MessageMetadata,
  TransactionProcessingContext,
  WorkerStatistics,
  ErrorHandlingConfig,
} from '../interfaces';

export class TransactionWorkerService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchangeName = 'ecommerce.transactions';
  private readonly queueName = 'transaction.save';
  private readonly routingKey = 'transaction.created';
  private readonly maxRetries = 3;
  private isProcessing = false;
  private redisClient: RedisClient;
  private cacheManager: CacheManager;

  constructor(private connectionUrl: string) {
    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'transaction-worker:',
    });
    this.cacheManager = new CacheManager(
      this.redisClient,
      3600,
      'transactions:'
    ); // 1 hour cache
  }

  /**
   * Connect to RabbitMQ and Redis, set up queue
   */
  async connect(): Promise<void> {
    try {
      logger.info('Connecting transaction worker to RabbitMQ and Redis', {
        url: this.connectionUrl.replace(/\/\/.*@/, '//***:***@'), // Hide credentials in logs
      });

      // Connect to Redis first
      await this.redisClient.connect();
      logger.info('Transaction worker connected to Redis');

      this.connection = await amqp.connect(this.connectionUrl);
      this.channel = await this.connection.createChannel();

      // Set prefetch to control how many messages are processed concurrently
      await this.channel.prefetch(10);

      // Declare exchange (ensure it exists)
      await this.channel.assertExchange(this.exchangeName, 'direct', {
        durable: true,
      });

      // Declare queue
      await this.channel.assertQueue(this.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${this.exchangeName}.dlx`,
          'x-dead-letter-routing-key': 'failed',
          'x-message-ttl': 60000 * 60 * 24, // 24 hours TTL
        },
      });

      // Bind queue to exchange
      await this.channel.bindQueue(
        this.queueName,
        this.exchangeName,
        this.routingKey
      );

      // Set up dead letter exchange for failed messages
      await this.channel.assertExchange(`${this.exchangeName}.dlx`, 'direct', {
        durable: true,
      });

      await this.channel.assertQueue(`${this.queueName}.failed`, {
        durable: true,
      });

      await this.channel.bindQueue(
        `${this.queueName}.failed`,
        `${this.exchangeName}.dlx`,
        'failed'
      );

      // Handle connection events
      this.connection.on('error', (error: Error) => {
        logger.error('RabbitMQ connection error:', error);
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.connection = null;
        this.channel = null;
      });

      logger.info('Transaction worker connected to RabbitMQ successfully', {
        exchangeName: this.exchangeName,
        queueName: this.queueName,
        routingKey: this.routingKey,
      });
    } catch (error) {
      logger.error('Failed to connect transaction worker to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Process transaction event message
   */
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

      // Check for duplicate message (deduplication)
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

      // Check if transaction already exists by transactionId
      const existingByTxnId = await TransactionHistory.findOne({
        transactionId: transactionEvent.transactionId,
      });

      if (existingByTxnId) {
        logger.info('Transaction already exists, updating status', {
          transactionId: transactionEvent.transactionId,
          existingStatus: existingByTxnId.status,
          newStatus: transactionEvent.status,
        });

        // Update existing transaction
        existingByTxnId.status = transactionEvent.status;
        existingByTxnId.processedAt = new Date();
        if (messageId && !existingByTxnId.messageId) {
          existingByTxnId.messageId = messageId;
        }
        await existingByTxnId.save();
      } else {
        // Create new transaction history record
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

      // Re-throw error to trigger retry mechanism
      throw error;
    }
  }

  /**
   * Message handler with retry logic
   */
  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg || !this.channel) {
      return;
    }

    const messageId = msg.properties.messageId as string;
    const retryCount =
      (msg.properties.headers?.['x-retry-count'] as number) || 0;

    try {
      // Parse message content
      const content = msg.content.toString();
      const transactionEvent: TransactionEvent = JSON.parse(content);

      // Validate message structure
      if (!transactionEvent.transactionId || !transactionEvent.orderId) {
        throw new Error('Invalid transaction event structure');
      }

      // Process the transaction
      await this.processTransactionEvent(
        transactionEvent,
        messageId,
        retryCount
      );

      // Acknowledge successful processing
      this.channel.ack(msg);

      logger.debug('Message processed and acknowledged', {
        transactionId: transactionEvent.transactionId,
        messageId,
      });
    } catch (error) {
      logger.error('Error processing message', {
        error,
        messageId,
        retryCount,
      });

      // Implement retry logic
      if (retryCount < this.maxRetries) {
        // Reject and requeue with retry count
        const newRetryCount = retryCount + 1;
        const delay = Math.pow(2, newRetryCount) * 1000; // Exponential backoff

        logger.info('Retrying message processing', {
          messageId,
          retryCount: newRetryCount,
          delay,
        });

        setTimeout(() => {
          if (this.channel) {
            // Update retry count in headers
            const headers = {
              ...msg.properties.headers,
              'x-retry-count': newRetryCount,
            };

            // Republish with updated retry count
            this.channel.publish(
              this.exchangeName,
              this.routingKey,
              msg.content,
              { ...msg.properties, headers }
            );

            this.channel.ack(msg);
          }
        }, delay);
      } else {
        // Max retries reached, send to dead letter queue
        logger.error('Max retries reached, sending to dead letter queue', {
          messageId,
          retryCount,
        });

        this.channel.nack(msg, false, false); // Don't requeue
      }
    }
  }

  /**
   * Start consuming messages from the queue
   */
  async startConsumer(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not available');
    }

    if (this.isProcessing) {
      logger.warn('Consumer already started');
      return;
    }

    this.isProcessing = true;

    logger.info('Starting transaction worker consumer', {
      queueName: this.queueName,
    });

    await this.channel.consume(this.queueName, msg => this.handleMessage(msg), {
      noAck: false, // Manual acknowledgment
    });

    logger.info('Transaction worker consumer started successfully');
  }

  /**
   * Stop consuming messages
   */
  async stopConsumer(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.isProcessing = false;

    if (this.channel) {
      await this.channel.cancel('transaction-worker-consumer');
    }

    logger.info('Transaction worker consumer stopped');
  }

  /**
   * Get worker status
   */
  getStatus(): WorkerStatus {
    return {
      connected: this.connection !== null && this.channel !== null,
      processing: this.isProcessing,
      queueName: this.queueName,
      exchangeName: this.exchangeName,
    };
  }

  /**
   * Disconnect from RabbitMQ and Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.stopConsumer();

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      // Disconnect from Redis
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
