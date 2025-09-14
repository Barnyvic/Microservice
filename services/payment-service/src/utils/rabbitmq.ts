import amqp from 'amqplib';
import { logger } from '@shared/utils/logger';
import type { TransactionEvent } from '@shared/types';

export class RabbitMQPublisher {
  private connection: any = null;
  private channel: any = null;
  private readonly exchangeName = 'ecommerce.transactions';
  private readonly routingKey = 'transaction.created';

  constructor(private connectionUrl: string) {}

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ', {
        url: this.connectionUrl.replace(/\/\/.*@/, '//***@'),
        hasUrl: !!this.connectionUrl,
        urlLength: this.connectionUrl.length,
      });

      this.connection = await amqp.connect(this.connectionUrl);
      logger.info('RabbitMQ connection established');

      this.channel = await this.connection.createChannel();
      logger.info('RabbitMQ channel created');

      await this.channel!.assertExchange(this.exchangeName, 'topic', {
        durable: true,
      });
      logger.info('Exchange asserted', { exchangeName: this.exchangeName });
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url: this.connectionUrl.replace(/\/\/.*@/, '//***@'),
        hasUrl: !!this.connectionUrl,
        urlLength: this.connectionUrl.length,
      });
      throw error;
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
            source: 'payment-service',
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

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
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

  getConnectionStatus(): {
    connected: boolean;
    exchangeName: string;
    routingKey: string;
  } {
    return {
      connected: this.isConnected(),
      exchangeName: this.exchangeName,
      routingKey: this.routingKey,
    };
  }
}
