import { Order, type OrderDocument } from '../models/Order';
import {
  NotFoundError,
  ValidationError,
  ServiceUnavailableError,
} from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import { HttpClient } from '@shared/utils/http-client';
import { LockManager } from '@shared/utils/lock-manager';
import { RedisClient } from '@shared/utils/redis-client';
import { CacheManager } from '@shared/utils/cache-manager';
import type { Order as IOrder, OrderStatus } from '@shared/types';
import env from '@shared/config/env';
import type {
  CreateOrderData,
  UpdateOrderData,
  PaginationOptions,
  OrderListResult,
  CustomerInfo,
  ProductInfo,
  PaymentRequest,
  PaymentResponse,
  OrderSearchFilters,
  OrderValidationResult,
} from '../interfaces';

export class OrderService {
  private customerClient: HttpClient;
  private productClient: HttpClient;
  private paymentClient: HttpClient;
  private lockManager: LockManager;
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

    this.lockManager = new LockManager();

    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'order-service:',
    });
    this.cacheManager = new CacheManager(this.redisClient, 300, 'orders:'); // 5 minute cache
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    await this.redisClient.connect();
  }

  /**
   * Disconnect Redis
   */
  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }

  /**
   * Validate customer exists
   */
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

      throw new ServiceUnavailableError('Customer service', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validate product exists and check availability
   */
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

      // First get product info
      const productResponse = await this.productClient.get<{
        success: boolean;
        data: ProductInfo;
      }>(`/api/v1/products/${productId}`, { requestId });

      if (!productResponse.success || !productResponse.data) {
        throw new NotFoundError('Product', productId);
      }

      const product = productResponse.data;

      // Check availability
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

      throw new ServiceUnavailableError('Product service', {
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reserve product stock
   */
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

  /**
   * Release product stock
   */
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
      // Don't throw error - this is cleanup
    }
  }

  /**
   * Process payment
   */
  private async processPayment(
    paymentData: PaymentRequest,
    requestId?: string
  ): Promise<PaymentResponse> {
    try {
      logger.info('Processing payment', {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
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

  /**
   * Create a new order following the exact flow from the diagram
   * Uses distributed locking to prevent race conditions
   */
  async createOrder(
    data: CreateOrderData,
    requestId?: string
  ): Promise<IOrder> {
    // Use distributed lock to prevent concurrent orders for the same product
    const lockKey = `order-creation:${data.productId}`;
    const lockTtl = 60000; // 60 seconds

    return this.lockManager.withLock(
      lockKey,
      async () => {
        return this.processOrderCreation(data, requestId);
      },
      lockTtl,
      requestId
    );
  }

  /**
   * Internal method to process order creation with lock protection
   */
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

      // Step 1: Validate customer exists
      const customer = await this.validateCustomer(data.customerId, requestId);
      logger.debug('Customer validation passed', {
        customerId: customer.customerId,
        requestId,
      });

      // Step 2: Validate product and check availability
      const product = await this.validateProductAndCheckAvailability(
        data.productId,
        data.quantity,
        requestId
      );
      logger.debug('Product validation passed', {
        productId: product.productId,
        requestId,
      });

      // Step 3: Check for duplicate order (idempotency)
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

      // Step 4: Reserve stock (atomic operation)
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

      // Step 5: Calculate total amount
      const amount = product.price * data.quantity;

      // Step 6: Create order with pending status (atomic)
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

      // Step 7: Initiate payment asynchronously
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

      // Cleanup: release reserved stock if needed
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

  /**
   * Check for duplicate orders to ensure idempotency
   */
  private async checkDuplicateOrder(
    customerId: string,
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<IOrder | null> {
    try {
      // Look for recent orders (within last 5 minutes) with same parameters
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

  /**
   * Process payment asynchronously to avoid blocking order creation
   */
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
        },
        requestId
      );

      // Use atomic update to prevent race conditions
      const updateResult = await Order.updateOne(
        {
          orderId: order.orderId,
          orderStatus: 'pending', // Only update if still pending
        },
        {
          orderStatus: paymentResponse.success ? 'processing' : 'failed',
          updatedAt: new Date(),
        }
      );

      if (updateResult.modifiedCount > 0) {
        logger.info('Order status updated after payment', {
          orderId: order.orderId,
          success: paymentResponse.success,
          newStatus: paymentResponse.success ? 'processing' : 'failed',
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
      logger.error('Payment processing failed, updating order status', {
        orderId: order.orderId,
        error: paymentError,
        requestId,
      });

      // Mark order as failed
      await Order.updateOne(
        {
          orderId: order.orderId,
          orderStatus: 'pending',
        },
        {
          orderStatus: 'failed',
          updatedAt: new Date(),
        }
      );
    }
  }

  /**
   * Get order by ID with caching
   */
  async getOrderById(orderId: string, requestId?: string): Promise<IOrder> {
    try {
      logger.debug('Fetching order by ID', { orderId, requestId });

      // Try to get from cache first
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

      // Cache the result
      await this.cacheManager.set(orderId, result);

      return result;
    } catch (error) {
      logger.error('Failed to fetch order', { error, orderId, requestId });
      throw error;
    }
  }

  /**
   * Update order
   */
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

  /**
   * List orders with pagination and filtering
   */
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

      // Build query
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

  /**
   * Get orders by customer ID
   */
  async getOrdersByCustomerId(
    customerId: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<OrderListResult> {
    return this.listOrders({ ...options, customerId }, requestId);
  }

  /**
   * Cancel order (if possible)
   */
  async cancelOrder(orderId: string, requestId?: string): Promise<IOrder> {
    try {
      logger.info('Canceling order', { orderId, requestId });

      const order = await Order.findOne({ orderId });

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      // Only allow cancellation if order is pending or processing
      if (!['pending', 'processing'].includes(order.orderStatus)) {
        throw new ValidationError('Order cannot be cancelled', {
          orderId,
          currentStatus: order.orderStatus,
        });
      }

      // Update order status
      order.orderStatus = 'cancelled';
      await order.save();

      // Release reserved stock
      await this.releaseProductStock(
        order.productId,
        order.quantity,
        requestId
      );

      logger.info('Order cancelled successfully', { orderId, requestId });

      return order.toObject();
    } catch (error) {
      logger.error('Failed to cancel order', { error, orderId, requestId });
      throw error;
    }
  }
}
