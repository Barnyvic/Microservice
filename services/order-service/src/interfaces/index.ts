import type { Order as IOrder, OrderStatus } from '@shared/types';

export interface CreateOrderData {
  customerId: string;
  productId: string;
  quantity: number;
}

export interface UpdateOrderData {
  quantity?: number;
  orderStatus?: OrderStatus;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface OrderListResult {
  orders: IOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerInfo {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  stock: number;
}

export interface PaymentRequest {
  customerId: string;
  orderId: string;
  amount: number;
  productId: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

export interface OrderSearchFilters {
  customerId?: string;
  productId?: string;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface ExtendedRequest {
  requestId?: string;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
}

export interface OrderValidationResult {
  isValid: boolean;
  customer?: CustomerInfo;
  product?: ProductInfo;
  errors?: string[];
}
