import type { Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import { asyncHandler } from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import type { ExtendedRequest } from '../interfaces';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  
  createOrder = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const order = await this.orderService.createOrder(req.body, req.requestId);

    logger.info('Order created via API', {
      orderId: order.orderId,
      customerId: order.customerId,
      productId: order.productId,
      orderStatus: order.orderStatus,
      requestId: req.requestId,
    });

    // Return response as specified in the requirements
    res.status(201).json({
      success: true,
      data: {
        customerId: order.customerId,
        orderId: order.orderId,
        productId: order.productId,
        orderStatus: order.orderStatus,
        amount: order.amount,
        quantity: order.quantity,
      },
    });
  });

  
  getOrder = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { orderId } = req.params;

    const order = await this.orderService.getOrderById(orderId, req.requestId);

    res.json({
      success: true,
      data: order,
    });
  });

  
  updateOrder = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { orderId } = req.params;

    const order = await this.orderService.updateOrder(
      orderId,
      req.body,
      req.requestId
    );

    logger.info('Order updated via API', {
      orderId,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: order,
    });
  });

  
  listOrders = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { page = 1, limit = 10, customerId, status } = req.query;

    const result = await this.orderService.listOrders(
      {
        page: Number(page),
        limit: Number(limit),
        customerId: customerId as string,
        status: status as any,
      },
      req.requestId
    );

    res.json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  
  getOrdersByCustomer = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { customerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await this.orderService.getOrdersByCustomerId(
        customerId,
        {
          page: Number(page),
          limit: Number(limit),
        },
        req.requestId
      );

      res.json({
        success: true,
        data: result.orders,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    }
  );

  
  cancelOrder = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { orderId } = req.params;

    const order = await this.orderService.cancelOrder(orderId, req.requestId);

    logger.info('Order cancelled via API', {
      orderId,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: order,
    });
  });
}




