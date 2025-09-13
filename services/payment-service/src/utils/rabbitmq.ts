import { Connection, Channel } from 'amqplib';
import { logger } from '@shared/utils/logger';
import type { TransactionEvent } from '@shared/types';

export class RabbitMQPublisher {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchangeName = 'ecommerce.transactions';
  private readonly routingKey = 'transaction.created';

  constructor(private connectionUrl: string) {}

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ', {
        url: this.connectionUrl.replace(/\/\/.*@/, '//***@'),
      });
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error });
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
          persistent: true, // Make message persistent
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
        error,
        transactionId: transactionEvent.transactionId,
        requestId,
      });
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
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
