import type { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { asyncHandler } from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import env from '@shared/config/env';
import type { ExtendedRequest } from '../interfaces';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService(env.RABBITMQ_URI!);
  }

  /**
   * Initialize the payment service
   */
  async initialize(): Promise<void> {
    await this.paymentService.initialize();
  }

  /**
   * Process payment (main endpoint called by order service)
   * This follows the exact flow from the diagram:
   * 1. Receive payment request from order service
   * 2. Process payment (demo implementation)
   * 3. Publish transaction details to RabbitMQ
   * 4. Return payment status
   */
  processPayment = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { customerId, orderId, amount, productId } = req.body;

    // Extract idempotency key from headers (following RFC standards)
    const idempotencyKey = req.headers['idempotency-key'] as string;

    const result = await this.paymentService.processPayment(
      {
        customerId,
        orderId,
        amount,
        productId,
        idempotencyKey,
      },
      req.requestId
    );

    logger.info('Payment processed via API', {
      orderId,
      transactionId: result.transactionId,
      status: result.status,
      success: result.success,
      requestId: req.requestId,
    });

    // Return response format as expected by order service
    if (result.success) {
      res.status(200).json({
        success: true,
        transactionId: result.transactionId,
        status: result.status,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Payment processing failed',
        status: result.status,
      });
    }
  });

  /**
   * Get payment by transaction ID
   */
  getPayment = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { transactionId } = req.params;

    const payment = await this.paymentService.getPaymentById(
      transactionId,
      req.requestId
    );

    res.json({
      success: true,
      data: payment,
    });
  });

  /**
   * Get payments by order ID
   */
  getPaymentsByOrder = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { orderId } = req.params;

      const payments = await this.paymentService.getPaymentsByOrderId(
        orderId,
        req.requestId
      );

      res.json({
        success: true,
        data: payments,
      });
    }
  );

  /**
   * List payments with pagination and filtering
   */
  listPayments = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { page = 1, limit = 10, customerId, orderId, status } = req.query;

    const result = await this.paymentService.listPayments(
      {
        page: Number(page),
        limit: Number(limit),
        customerId: customerId as string,
        orderId: orderId as string,
        status: status as any,
      },
      req.requestId
    );

    res.json({
      success: true,
      data: result.payments,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * Get payments by customer ID
   */
  getPaymentsByCustomer = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { customerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await this.paymentService.getPaymentsByCustomerId(
        customerId,
        {
          page: Number(page),
          limit: Number(limit),
        },
        req.requestId
      );

      res.json({
        success: true,
        data: result.payments,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    }
  );

  /**
   * Get message queue status
   */
  getMessageQueueStatus = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const status = this.paymentService.getMessageQueueStatus();

      res.json({
        success: true,
        data: status,
      });
    }
  );

  /**
   * Disconnect from external services (for graceful shutdown)
   */
  async disconnect(): Promise<void> {
    await this.paymentService.disconnect();
  }
}
