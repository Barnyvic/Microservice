import { Response, NextFunction } from 'express';
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

  async initialize(): Promise<void> {
    await this.paymentService.initialize();
  }

  processPayment = asyncHandler(
    async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
      const { customerId, orderId, amount, productId } = req.body as any;

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
    }
  );

  getPayment = asyncHandler(
    async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
      const { transactionId } = req.params;

      const payment = await this.paymentService.getPaymentById(
        transactionId!,
        req.requestId
      );

      res.json({
        success: true,
        data: payment,
      });
    }
  );

  getPaymentsByOrder = asyncHandler(
    async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
      const { orderId } = req.params;

      const payments = await this.paymentService.getPaymentsByOrderId(
        orderId!,
        req.requestId
      );

      res.json({
        success: true,
        data: payments,
      });
    }
  );

  listPayments = asyncHandler(
    async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
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
    }
  );

  getPaymentsByCustomer = asyncHandler(
    async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
      const { customerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await this.paymentService.getPaymentsByCustomerId(
        customerId!,
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

  getMessageQueueStatus = asyncHandler(
    async (_req: ExtendedRequest, res: Response, _next: NextFunction) => {
      const status = this.paymentService.getMessageQueueStatus();

      res.json({
        success: true,
        data: status,
      });
    }
  );

  async disconnect(): Promise<void> {
    await this.paymentService.disconnect();
  }
}
