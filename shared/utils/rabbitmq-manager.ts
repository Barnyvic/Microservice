import amqp from 'amqplib';
import { logger } from './logger';
import type { TransactionEvent } from '../types';

export interface RabbitMQConfig {
  connectionUrl: string;
  exchangeName?: string;
  routingKey?: string;
  queueName?: string;
}

export interface RabbitMQConnectionStatus {
  connected: boolean;
  exchangeName: string;
  routingKey: string;
  queueName?: string;
}

export class RabbitMQManager {
  private static instance: RabbitMQManager | null = null;
  private connection: any = null;
  private channel: any = null;
  private readonly exchangeName: string;
  private readonly routingKey: string;
  private readonly queueName?: string;
  private isConnecting = false;

  private constructor(config: RabbitMQConfig) {
    this.exchangeName = config.exchangeName || 'ecommerce.transactions';
    this.routingKey = config.routingKey || 'transaction.created';
    this.queueName = config.queueName;
  }

  static getInstance(config: RabbitMQConfig): RabbitMQManager {
    if (!RabbitMQManager.instance) {
      RabbitMQManager.instance = new RabbitMQManager(config);
    }
    return RabbitMQManager.instance;
  }

  static resetInstance(): void {
    RabbitMQManager.instance = null;
  }

  async connect(): Promise<void> {
    if (this.connection && this.channel) {
      logger.debug('RabbitMQ already connected');
      return;
    }

    if (this.isConnecting) {
      logger.debug('RabbitMQ connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      logger.info('Connecting to RabbitMQ', {
        exchangeName: this.exchangeName,
        routingKey: this.routingKey,
        queueName: this.queueName,
      });

      this.connection = await amqp.connect(process.env.RABBITMQ_URI!);
      logger.info('RabbitMQ connection established');

      this.channel = await this.connection.createChannel();
      logger.info('RabbitMQ channel created');

      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true,
      });
      logger.info('Exchange asserted', { exchangeName: this.exchangeName });

      if (this.queueName) {
        await this.channel.assertQueue(this.queueName, {
          durable: true,
        });
        logger.info('Queue asserted', { queueName: this.queueName });

        await this.channel.bindQueue(
          this.queueName,
          this.exchangeName,
          this.routingKey
        );
        logger.info('Queue bound to exchange', {
          queueName: this.queueName,
          exchangeName: this.exchangeName,
          routingKey: this.routingKey,
        });
      }
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        exchangeName: this.exchangeName,
        routingKey: this.routingKey,
        queueName: this.queueName,
      });
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  async publishTransactionEvent(
    transactionEvent: TransactionEvent,
    requestId?: string
  ): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not available');
      }

      const message = JSON.stringify(transactionEvent);
      const messageBuffer = Buffer.from(message);

      const published = this.channel.publish(
        this.exchangeName,
        this.routingKey,
        messageBuffer,
        {
          persistent: true,
          messageId: transactionEvent.transactionId,
          timestamp: Date.now(),
          headers: {
            requestId: requestId || 'unknown',
            source: 'shared-rabbitmq-manager',
          },
        }
      );

      if (!published) {
        throw new Error('Failed to publish message to RabbitMQ');
      }

      logger.info('Transaction event published to RabbitMQ', {
        transactionId: transactionEvent.transactionId,
        orderId: transactionEvent.orderId,
        customerId: transactionEvent.customerId,
        productId: transactionEvent.productId,
        exchange: this.exchangeName,
        routingKey: this.routingKey,
        requestId,
      });
    } catch (error) {
      logger.error('Failed to publish transaction event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        transactionId: transactionEvent.transactionId,
        requestId,
        channelAvailable: !!this.channel,
        connectionAvailable: !!this.connection,
      });
      throw error;
    }
  }

  async consumeMessages(onMessage: (msg: any) => Promise<void>): Promise<void> {
    if (!this.channel || !this.queueName) {
      throw new Error('RabbitMQ channel or queue not available');
    }

    logger.info('Starting message consumer', {
      queueName: this.queueName,
    });

    await this.channel.consume(this.queueName, onMessage, {
      noAck: false,
    });

    logger.info('Message consumer started successfully');
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.connection || !this.channel) {
        logger.debug('RabbitMQ connection or channel not available', {
          hasConnection: !!this.connection,
          hasChannel: !!this.channel,
        });
        return false;
      }

      await this.channel.checkExchange(this.exchangeName);
      logger.debug('RabbitMQ connection test successful');
      return true;
    } catch (error) {
      logger.debug('RabbitMQ connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hasConnection: !!this.connection,
        hasChannel: !!this.channel,
      });
      return false;
    }
  }

  async ensureConnection(): Promise<boolean> {
    try {
      if (this.isConnected()) {
        const isHealthy = await this.testConnection();
        if (isHealthy) {
          return true;
        }
      }

      logger.info('Attempting to connect to RabbitMQ...');
      await this.connect();
      return true;
    } catch (error) {
      logger.warn('Failed to ensure RabbitMQ connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  getConnectionStatus(): RabbitMQConnectionStatus {
    return {
      connected: this.isConnected(),
      exchangeName: this.exchangeName,
      routingKey: this.routingKey,
      queueName: this.queueName,
    };
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await (this.connection as any).close();
        this.connection = null;
      }

      logger.info('RabbitMQ connection closed successfully');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }
}
