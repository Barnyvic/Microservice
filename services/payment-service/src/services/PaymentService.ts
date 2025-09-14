import { Payment, type PaymentDocument } from '../models/Payment';
import { RabbitMQManager } from '@shared/utils/rabbitmq-manager';
import { NotFoundError } from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import { RedisLockManager } from '@shared/utils/redis-lock-manager';
import { RedisClient } from '@shared/utils/redis-client';
import type {
  Transaction as ITransaction,
  TransactionEvent,
} from '@shared/types';
import { TransactionStatus } from '@shared/types';
import { createHash } from 'crypto';
import env from '@shared/config/env';
import type {
  ProcessPaymentData,
  PaymentResponse,
  PaginationOptions,
  PaymentListResult,
} from '../interfaces';

export class PaymentService {
  private rabbitMQManager: RabbitMQManager;
  private lockManager: RedisLockManager;
  private redisClient: RedisClient;

  constructor(rabbitMQUrl: string) {
    this.rabbitMQManager = RabbitMQManager.getInstance({
      connectionUrl: rabbitMQUrl,
      exchangeName: 'ecommerce.transactions',
      routingKey: 'transaction.created',
    });

    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'payment-service:',
    });

    this.lockManager = new RedisLockManager(this.redisClient);
  }

  async initialize(): Promise<void> {
    await this.redisClient.connect();

    try {
      await this.rabbitMQManager.connect();
      logger.info('RabbitMQ connected successfully');
    } catch (error) {
      logger.error(
        'RabbitMQ connection failed - event publishing will be disabled',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.rabbitMQManager.disconnect();
    } catch (error) {
      logger.warn('Error disconnecting from RabbitMQ', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    await this.redisClient.disconnect();
  }

  private generateIdempotencyKey(data: ProcessPaymentData): string {
    if (data.idempotencyKey) {
      return data.idempotencyKey;
    }

    const keyData = `${data.customerId}:${data.orderId}:${data.amount}:${data.productId}`;
    return createHash('sha256').update(keyData).digest('hex').substring(0, 32);
  }

  private async simulatePaymentProcessing(
    amount: number,
    requestId?: string
  ): Promise<{ success: boolean; status: TransactionStatus }> {
    logger.info('Simulating payment processing', { amount, requestId });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const success = Math.random() > 0.1;

    return {
      success,
      status: success ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
    };
  }

  async processPayment(
    data: ProcessPaymentData,
    requestId?: string
  ): Promise<PaymentResponse> {
    const lockKey = `payment-processing:${data.orderId}`;
    const lockTtl = 30000;

    try {
      return await this.lockManager.withLock(
        lockKey,
        async () => {
          return this.processPaymentInternal(data, requestId);
        },
        { ttlMs: lockTtl },
        requestId
      );
    } catch (error) {
      logger.error('Failed to acquire payment processing lock', {
        error,
        orderId: data.orderId,
        requestId,
      });

      return {
        success: false,
        error: 'Payment processing temporarily unavailable',
      };
    }
  }

  private async processPaymentInternal(
    data: ProcessPaymentData,
    requestId?: string
  ): Promise<PaymentResponse> {
    try {
      logger.info('Processing payment request with lock protection', {
        customerId: data.customerId,
        orderId: data.orderId,
        amount: data.amount,
        productId: data.productId,
        requestId,
      });

      const idempotencyKey = this.generateIdempotencyKey(data);

      const existingPayment = await this.checkIdempotencyAtomic(
        idempotencyKey,
        data,
        requestId
      );

      if (existingPayment) {
        logger.info('Returning existing payment result (idempotent)', {
          transactionId: existingPayment.transactionId,
          orderId: existingPayment.orderId,
          status: existingPayment.status,
          requestId,
        });

        return {
          success: existingPayment.status === TransactionStatus.COMPLETED,
          transactionId: existingPayment.transactionId,
          status: existingPayment.status,
        };
      }

      const payment = await Payment.findOne({ idempotencyKey });

      if (!payment) {
        throw new Error('Payment record not found after creation');
      }

      logger.info('Payment record created', {
        transactionId: payment.transactionId,
        orderId: payment.orderId,
        requestId,
      });

      const processingResult = await this.simulatePaymentProcessing(
        data.amount,
        requestId
      );

      const updateResult = await Payment.updateOne(
        {
          transactionId: payment.transactionId,
          status: TransactionStatus.PENDING,
        },
        {
          status: processingResult.status,
          updatedAt: new Date(),
        }
      );

      if (updateResult.modifiedCount === 0) {
        logger.warn(
          'Payment status not updated - may have been processed elsewhere',
          {
            transactionId: payment.transactionId,
            requestId,
          }
        );

        const currentPayment = await Payment.findOne({
          transactionId: payment.transactionId,
        });
        return {
          success: currentPayment?.status === TransactionStatus.COMPLETED,
          transactionId: payment.transactionId,
          status: currentPayment?.status,
        };
      }

      logger.info('Payment processing completed', {
        transactionId: payment.transactionId,
        orderId: payment.orderId,
        status: processingResult.status,
        success: processingResult.success,
        requestId,
      });

      const transactionEvent: TransactionEvent = {
        transactionId: payment.transactionId,
        orderId: payment.orderId,
        customerId: payment.customerId,
        productId: payment.productId,
        amount: payment.amount,
        status: processingResult.status,
        timestamp: new Date(),
      };

      try {
        const isConnected = await this.rabbitMQManager.ensureConnection();
        if (!isConnected) {
          logger.warn(
            'RabbitMQ not available, skipping transaction event publishing',
            {
              transactionId: payment.transactionId,
              requestId,
            }
          );
        } else {
          await this.rabbitMQManager.publishTransactionEvent(
            transactionEvent,
            requestId
          );
        }
      } catch (error) {
        logger.warn(
          'Failed to publish transaction event, continuing without event',
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            transactionId: payment.transactionId,
            requestId,
          }
        );
      }

      return {
        success: processingResult.success,
        transactionId: payment.transactionId,
        status: processingResult.status,
        error: processingResult.success
          ? undefined
          : 'Payment processing failed',
      };
    } catch (error) {
      logger.error('Payment processing failed', {
        error,
        orderId: data.orderId,
        requestId,
      });

      return {
        success: false,
        error: 'Internal payment processing error',
      };
    }
  }

  private async checkIdempotencyAtomic(
    idempotencyKey: string,
    data: ProcessPaymentData,
    requestId?: string
  ): Promise<PaymentDocument | null> {
    try {
      logger.debug('Creating payment record with data', {
        customerId: data.customerId,
        orderId: data.orderId,
        productId: data.productId,
        amount: data.amount,
        idempotencyKey,
        requestId,
      });

      try {
        const payment = await Payment.create({
          customerId: data.customerId,
          orderId: data.orderId,
          productId: data.productId,
          amount: data.amount,
          status: TransactionStatus.PENDING,
          idempotencyKey,
          paymentMethod: 'demo_payment',
        });

        logger.info('New payment record created atomically', {
          transactionId: payment.transactionId,
          orderId: payment.orderId,
          idempotencyKey,
          requestId,
        });

        return null;
      } catch (error: any) {
        if (error.code === 11000 && error.message.includes('idempotency')) {
          const existingPayment = await Payment.findOne({ idempotencyKey });

          if (existingPayment) {
            logger.info('Found existing payment with same idempotency key', {
              transactionId: existingPayment.transactionId,
              orderId: existingPayment.orderId,
              idempotencyKey,
              requestId,
            });
            return existingPayment;
          }
        }
        throw error;
      }
    } catch (error) {
      logger.error('Error in atomic idempotency check', {
        error,
        idempotencyKey,
        requestId,
      });
      throw error;
    }
  }

  async getPaymentById(
    transactionId: string,
    requestId?: string
  ): Promise<ITransaction> {
    try {
      logger.debug('Fetching payment by transaction ID', {
        transactionId,
        requestId,
      });

      const payment = await Payment.findOne({ transactionId });

      if (!payment) {
        throw new NotFoundError('Payment', transactionId);
      }

      return payment.toObject();
    } catch (error) {
      logger.error('Failed to fetch payment', {
        error,
        transactionId,
        requestId,
      });
      throw error;
    }
  }

  async getPaymentsByOrderId(
    orderId: string,
    requestId?: string
  ): Promise<ITransaction[]> {
    try {
      logger.debug('Fetching payments by order ID', { orderId, requestId });

      const payments = await Payment.find({ orderId })
        .sort({ createdAt: -1 })
        .lean();

      return payments.map(payment => {
        const { _id, __v, idempotencyKey, ...paymentData } = payment;
        return paymentData as ITransaction;
      });
    } catch (error) {
      logger.error('Failed to fetch payments by order ID', {
        error,
        orderId,
        requestId,
      });
      throw error;
    }
  }

  async listPayments(
    options: PaginationOptions & {
      customerId?: string;
      orderId?: string;
      status?: TransactionStatus;
    },
    requestId?: string
  ): Promise<PaymentListResult> {
    try {
      logger.debug('Listing payments', { options, requestId });

      const { page, limit, customerId, orderId, status } = options;
      const skip = (page - 1) * limit;

      const query: Record<string, unknown> = {};

      if (customerId) {
        query.customerId = customerId;
      }

      if (orderId) {
        query.orderId = orderId;
      }

      if (status) {
        query.status = status;
      }

      const [payments, total] = await Promise.all([
        Payment.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Payment.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        payments: payments.map(payment => {
          const { _id, __v, idempotencyKey, ...paymentData } = payment;
          return paymentData as ITransaction;
        }),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Failed to list payments', { error, options, requestId });
      throw error;
    }
  }

  async getPaymentsByCustomerId(
    customerId: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<PaymentListResult> {
    return this.listPayments({ ...options, customerId }, requestId);
  }

  getMessageQueueStatus(): {
    connected: boolean;
    exchangeName: string;
    routingKey: string;
  } {
    return this.rabbitMQManager.getConnectionStatus();
  }
}
