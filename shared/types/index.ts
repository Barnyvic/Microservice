export interface Customer {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Product {
  productId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  stock: number;
  specifications: Record<string, unknown>;
  images: string[];
  weight: number;
  dimensions: Dimensions;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface Order {
  orderId: string;
  customerId: string;
  productId: string;
  quantity: number;
  amount: number;
  orderStatus: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export interface Transaction {
  transactionId: string;
  orderId: string;
  customerId: string;
  productId: string;
  amount: number;
  status: TransactionStatus;
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface CreateOrderRequest {
  customerId: string;
  productId: string;
  quantity: number;
}

export interface CreateOrderResponse {
  success: boolean;
  data?: {
    orderId: string;
    customerId: string;
    productId: string;
    amount: number;
    orderStatus: OrderStatus;
  };
  error?: string;
}

export interface PaymentRequest {
  customerId: string;
  orderId: string;
  amount: number;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: TransactionStatus;
  error?: string;
}

export interface TransactionEvent {
  transactionId: string;
  orderId: string;
  customerId: string;
  productId: string;
  amount: number;
  status: TransactionStatus;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  service: string;
  version: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
    messageQueue?: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    };
  };
}

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  CUSTOMER_SERVICE_PORT: number;
  PRODUCT_SERVICE_PORT: number;
  PAYMENT_SERVICE_PORT: number;
  ORDER_SERVICE_PORT: number;
  MONGODB_URI: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';

  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;

  RABBITMQ_URI?: string;
  CUSTOMER_SERVICE_URL?: string;
  PRODUCT_SERVICE_URL?: string;
  PAYMENT_SERVICE_URL?: string;
  ORDER_SERVICE_URL?: string;
  JWT_SECRET?: string;
  API_KEY?: string;
}
