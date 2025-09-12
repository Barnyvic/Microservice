import type { Order as IOrder, OrderStatus } from '@shared/types';

/**
 * Interface for creating a new order
 */
export interface CreateOrderData {
  customerId: string;
  productId: string;
  quantity: number;
}

/**
 * Interface for updating order data
 */
export interface UpdateOrderData {
  quantity?: number;
  orderStatus?: OrderStatus;
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface for order list result with pagination
 */
export interface OrderListResult {
  orders: IOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for customer information
 */
export interface CustomerInfo {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Interface for product information
 */
export interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  stock: number;
}

/**
 * Interface for payment request
 */
export interface PaymentRequest {
  customerId: string;
  orderId: string;
  amount: number;
}

/**
 * Interface for payment response
 */
export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

/**
 * Interface for order search filters
 */
export interface OrderSearchFilters {
  customerId?: string;
  productId?: string;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Interface for extended request with requestId
 */
export interface ExtendedRequest {
  requestId?: string;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
}

/**
 * Interface for order validation result
 */
export interface OrderValidationResult {
  isValid: boolean;
  customer?: CustomerInfo;
  product?: ProductInfo;
  errors?: string[];
}
