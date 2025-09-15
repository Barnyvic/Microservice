import { Order, type OrderDocument } from '../models/Order';
import {
  NotFoundError,
  ValidationError,
  ServiceUnavailableError,
} from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import { HttpClient } from '@shared/utils/http-client';
import { RedisLockManager } from '@shared/utils/redis-lock-manager';
import { RedisClient } from '@shared/utils/redis-client';
import { CacheManager } from '@shared/utils/cache-manager';
import { Order as IOrder, OrderStatus } from '@shared/types';
import env from '@shared/config/env';
import axios from 'axios';
import type {
  CreateOrderData,
  UpdateOrderData,
  PaginationOptions,
  OrderListResult,
  CustomerInfo,
  ProductInfo,
  PaymentRequest,
  PaymentResponse,
} from '../interfaces';

export class OrderService {
  private customerClient: HttpClient;
  private productClient: HttpClient;
  private paymentClient: HttpClient;
  private lockManager: RedisLockManager;
  private redisClient: RedisClient;
  private cacheManager: CacheManager;

  constructor() {
    this.customerClient = new HttpClient({
      baseURL: env.CUSTOMER_SERVICE_URL!,
      timeout: 10000,
      retries: 3,
    });

    this.productClient = new HttpClient({
      baseURL: env.PRODUCT_SERVICE_URL!,
      timeout: 10000,
      retries: 3,
    });

    this.paymentClient = new HttpClient({
      baseURL: env.PAYMENT_SERVICE_URL!,
      timeout: 15000,
      retries: 3,
    });

    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'order-service:',
    });

    this.lockManager = new RedisLockManager(this.redisClient);
    this.cacheManager = new CacheManager(this.redisClient, 300, 'orders:');
  }

  async initialize(): Promise<void> {
    await this.redisClient.connect();
  }

  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }

  private async validateCustomer(
    customerId: string,
    requestId?: string
  ): Promise<CustomerInfo> {
    try {
      logger.debug('Validating customer', { customerId, requestId });

      const response = await this.customerClient.get<{
        success: boolean;
        data: CustomerInfo;
      }>(`/api/v1/customers/${customerId}`, { requestId });

      if (!response.success || !response.data) {
        throw new NotFoundError('Customer', customerId);
      }

      return response.data;
    } catch (error) {
      logger.error('Customer validation failed', {
        error,
        customerId,
        requestId,
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundError('Customer', customerId);
      }

      throw new ServiceUnavailableError('Customer service', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async validateProductAndCheckAvailability(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<ProductInfo> {
    try {
      logger.debug('Validating product and checking availability', {
        productId,
        quantity,
        requestId,
      });

      const productResponse = await this.productClient.get<{
        success: boolean;
        data: ProductInfo;
      }>(`/api/v1/products/${productId}`, { requestId });

      if (!productResponse.success || !productResponse.data) {
        throw new NotFoundError('Product', productId);
      }

      const product = productResponse.data;

      const availabilityResponse = await this.productClient.get<{
        success: boolean;
        data: { available: boolean; stock: number };
      }>(`/api/v1/products/${productId}/availability?quantity=${quantity}`, {
        requestId,
      });

      if (
        !availabilityResponse.success ||
        !availabilityResponse.data.available
      ) {
        throw new ValidationError(
          'Product is not available in requested quantity',
          {
            productId,
            requestedQuantity: quantity,
            availableStock: availabilityResponse.data?.stock || 0,
          }
        );
      }

      return product;
    } catch (error) {
      logger.error('Product validation failed', {
        error,
        productId,
        quantity,
        requestId,
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundError('Product', productId);
      }

      throw new ServiceUnavailableError('Product service', {
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async reserveProductStock(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<boolean> {
    try {
      logger.info('Reserving product stock', {
        productId,
        quantity,
        requestId,
      });

      const response = await this.productClient.post<{
        success: boolean;
        data: { reserved: boolean };
      }>(`/api/v1/products/${productId}/reserve`, { quantity }, { requestId });

      return response.success && response.data.reserved;
    } catch (error) {
      logger.error('Failed to reserve product stock', {
        error,
        productId,
        quantity,
        requestId,
      });
      return false;
    }
  }

  private async releaseProductStock(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<void> {
    try {
      logger.info('Releasing product stock', {
        productId,
        quantity,
        requestId,
      });

      await this.productClient.post<{
        success: boolean;
        data: { released: boolean };
      }>(`/api/v1/products/${productId}/release`, { quantity }, { requestId });
    } catch (error) {
      logger.error('Failed to release product stock', {
        error,
        productId,
        quantity,
        requestId,
      });
    }
  }

  private async processPayment(
    paymentData: PaymentRequest,
    requestId?: string
  ): Promise<PaymentResponse> {
    try {
      logger.info('Processing payment', {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        productId: paymentData.productId,
        requestId,
      });

      const response = await this.paymentClient.post<PaymentResponse>(
        '/api/v1/payments/process',
        paymentData,
        { requestId }
      );

      return response;
    } catch (error) {
      logger.error('Payment processing failed', {
        error,
        orderId: paymentData.orderId,
        requestId,
      });

      throw new ServiceUnavailableError('Payment service', {
        orderId: paymentData.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createOrder(
    data: CreateOrderData,
    requestId?: string
  ): Promise<IOrder> {
    const lockKey = `order-creation:${data.productId}`;
    const lockTtl = 60000;

    try {
      return await this.lockManager.withLock(
        lockKey,
        async () => {
          return this.processOrderCreation(data, requestId);
        },
        { ttlMs: lockTtl },
        requestId
      );
    } catch (error) {
      logger.error('Lock acquisition failed, retrying without lock', {
        error,
        lockKey,
        requestId,
      });

      return this.processOrderCreation(data, requestId);
    }
  }

  private async processOrderCreation(
    data: CreateOrderData,
    requestId?: string
  ): Promise<IOrder> {
    let stockReserved = false;
    let order: OrderDocument | null = null;

    try {
      logger.info('Creating new order with lock protection', {
        customerId: data.customerId,
        productId: data.productId,
        quantity: data.quantity,
        requestId,
      });

      const customer = await this.validateCustomer(data.customerId, requestId);
      logger.debug('Customer validation passed', {
        customerId: customer._id,
        requestId,
      });

      const product = await this.validateProductAndCheckAvailability(
        data.productId,
        data.quantity,
        requestId
      );
      logger.debug('Product validation passed', {
        productId: product.productId,
        requestId,
      });

      const duplicateCheck = await this.checkDuplicateOrder(
        data.customerId,
        data.productId,
        data.quantity,
        requestId
      );

      if (duplicateCheck) {
        logger.info('Duplicate order detected, returning existing order', {
          orderId: duplicateCheck.orderId,
          requestId,
        });
        return duplicateCheck;
      }

      stockReserved = await this.reserveProductStock(
        data.productId,
        data.quantity,
        requestId
      );

      if (!stockReserved) {
        throw new ValidationError('Failed to reserve product stock', {
          productId: data.productId,
          quantity: data.quantity,
        });
      }

      const amount = product.price * data.quantity;

      order = new Order({
        customerId: data.customerId,
        productId: data.productId,
        quantity: data.quantity,
        amount,
        orderStatus: 'pending',
      });

      const savedOrder = await order.save();
      logger.info('Order created with pending status', {
        orderId: savedOrder.orderId,
        requestId,
      });

      this.processPaymentAsync(savedOrder, requestId);

      logger.info('Order created successfully', {
        orderId: savedOrder.orderId,
        customerId: savedOrder.customerId,
        productId: savedOrder.productId,
        orderStatus: savedOrder.orderStatus,
        requestId,
      });

      return savedOrder.toObject();
    } catch (error) {
      logger.error('Failed to create order', {
        error,
        customerId: data.customerId,
        productId: data.productId,
        requestId,
      });

      if (stockReserved) {
        await this.releaseProductStock(
          data.productId,
          data.quantity,
          requestId
        );
      }

      throw error;
    }
  }

  private async checkDuplicateOrder(
    customerId: string,
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<IOrder | null> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const existingOrder = await Order.findOne({
        customerId,
        productId,
        quantity,
        createdAt: { $gte: fiveMinutesAgo },
        orderStatus: { $in: ['pending', 'processing', 'completed'] },
      }).sort({ createdAt: -1 });

      return existingOrder ? existingOrder.toObject() : null;
    } catch (error) {
      logger.error('Failed to check for duplicate orders', {
        error,
        customerId,
        productId,
        requestId,
      });
      return null;
    }
  }

  private async processPaymentAsync(
    order: OrderDocument,
    requestId?: string
  ): Promise<void> {
    try {
      const paymentResponse = await this.processPayment(
        {
          customerId: order.customerId,
          orderId: order.orderId,
          amount: order.amount,
          productId: order.productId,
        },
        requestId
      );

      const updateResult = await Order.updateOne(
        {
          orderId: order.orderId,
          orderStatus: 'pending',
        },
        {
          orderStatus: paymentResponse.success ? 'completed' : 'failed',
          updatedAt: new Date(),
        }
      );

      if (!paymentResponse.success) {
        try {
          await this.releaseProductStock(
            order.productId,
            order.quantity,
            requestId
          );
          logger.info('Stock released after payment failure', {
            orderId: order.orderId,
            productId: order.productId,
            quantity: order.quantity,
            requestId,
          });
        } catch (stockError) {
          logger.error('Failed to release stock after payment failure', {
            orderId: order.orderId,
            productId: order.productId,
            quantity: order.quantity,
            error: stockError,
            requestId,
          });
        }
      }

      if (updateResult.modifiedCount > 0) {
        logger.info('Order status updated after payment', {
          orderId: order.orderId,
          success: paymentResponse.success,
          newStatus: paymentResponse.success ? 'completed' : 'failed',
          requestId,
        });
      } else {
        logger.warn(
          'Order status not updated - may have been modified elsewhere',
          {
            orderId: order.orderId,
            requestId,
          }
        );
      }
    } catch (paymentError) {
      logger.error(
        'Payment processing failed, updating order status and releasing stock',
        {
          orderId: order.orderId,
          productId: order.productId,
          quantity: order.quantity,
          error: paymentError,
          requestId,
        }
      );

      const updateResult = await Order.updateOne(
        {
          orderId: order.orderId,
          orderStatus: 'pending',
        },
        {
          orderStatus: 'failed',
          updatedAt: new Date(),
        }
      );

      if (updateResult.modifiedCount > 0) {
        logger.info('Order status updated to failed', {
          orderId: order.orderId,
          requestId,
        });
      }

      try {
        await this.releaseProductStock(
          order.productId,
          order.quantity,
          requestId
        );
        logger.info('Stock released successfully after payment failure', {
          orderId: order.orderId,
          productId: order.productId,
          quantity: order.quantity,
          requestId,
        });
      } catch (stockError) {
        logger.error('Failed to release stock after payment failure', {
          orderId: order.orderId,
          productId: order.productId,
          quantity: order.quantity,
          error: stockError,
          requestId,
        });
      }
    }
  }

  async cancelOrder(
    orderId: string,
    reason: string = 'customer_request',
    requestId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Cancelling order', { orderId, reason, requestId });

      const order = await Order.findOne({ orderId });
      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

        
      if (!['pending', 'processing'].includes(order.orderStatus)) {
        return {
          success: false,
          message: `Cannot cancel order with status: ${order.orderStatus}`,
        };
      }

      const updateResult = await Order.updateOne(
        { orderId },
        {
          orderStatus: 'cancelled',
          updatedAt: new Date(),
        }
      );

      if (updateResult.modifiedCount === 0) {
        return {
          success: false,
          message:
            'Order could not be cancelled - may have been modified elsewhere',
        };
      }

      
      try {
        await this.releaseProductStock(
          order.productId,
          order.quantity,
          requestId
        );
        logger.info('Stock released after order cancellation', {
          orderId,
          productId: order.productId,
          quantity: order.quantity,
          reason,
          requestId,
        });
      } catch (stockError) {
        logger.error('Failed to release stock after order cancellation', {
          orderId,
          productId: order.productId,
          quantity: order.quantity,
          error: stockError,
          requestId,
        });
      }

      logger.info('Order cancelled successfully', {
        orderId,
        reason,
        requestId,
      });

      return {
        success: true,
        message: 'Order cancelled successfully',
      };
    } catch (error) {
      logger.error('Failed to cancel order', {
        orderId,
        error,
        requestId,
      });
      throw error;
    }
  }

  async getOrderById(orderId: string, requestId?: string): Promise<IOrder> {
    try {
      logger.debug('Fetching order by ID', { orderId, requestId });

      const cached = await this.cacheManager.get<IOrder>(orderId);
      if (cached) {
        logger.debug('Order found in cache', { orderId, requestId });
        return cached;
      }

      const order = await Order.findOne({ orderId });

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      const result = order.toObject();

      await this.cacheManager.set(orderId, result);

      return result;
    } catch (error) {
      logger.error('Failed to fetch order', { error, orderId, requestId });
      throw error;
    }
  }

  async updateOrder(
    orderId: string,
    data: UpdateOrderData,
    requestId?: string
  ): Promise<IOrder> {
    try {
      logger.info('Updating order', { orderId, requestId });

      const order = await Order.findOneAndUpdate({ orderId }, data, {
        new: true,
        runValidators: true,
      });

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      logger.info('Order updated successfully', { orderId, requestId });

      return order.toObject();
    } catch (error) {
      logger.error('Failed to update order', { error, orderId, requestId });
      throw error;
    }
  }

  async listOrders(
    options: PaginationOptions & {
      customerId?: string;
      status?: OrderStatus;
    },
    requestId?: string
  ): Promise<OrderListResult> {
    try {
      logger.debug('Listing orders', { options, requestId });

      const { page, limit, customerId, status } = options;
      const skip = (page - 1) * limit;

      const query: Record<string, unknown> = {};

      if (customerId) {
        query.customerId = customerId;
      }

      if (status) {
        query.orderStatus = status;
      }

      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        orders: orders.map(order => {
          const { _id, __v, ...orderData } = order;
          return orderData as IOrder;
        }),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Failed to list orders', { error, options, requestId });
      throw error;
    }
  }

  async getOrdersByCustomerId(
    customerId: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<OrderListResult> {
    return this.listOrders({ ...options, customerId }, requestId);
  }
}
