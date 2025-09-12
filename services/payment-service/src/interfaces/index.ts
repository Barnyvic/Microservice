import type { Transaction as ITransaction, TransactionStatus } from '@shared/types';

/**
 * Interface for processing payment data
 */
export interface ProcessPaymentData {
  customerId: string;
  orderId: string;
  amount: number;
  productId?: string;
  idempotencyKey?: string;
}

/**
 * Interface for payment response
 */
export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: TransactionStatus;
  error?: string;
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface for payment list result with pagination
 */
export interface PaymentListResult {
  payments: ITransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for payment search filters
 */
export interface PaymentSearchFilters {
  customerId?: string;
  orderId?: string;
  status?: TransactionStatus;
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
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Interface for message queue status
 */
export interface MessageQueueStatus {
  connected: boolean;
  exchangeName: string;
  routingKey: string;
  lastPublishedAt?: Date;
  publishCount: number;
  errorCount: number;
}

/**
 * Interface for idempotency check result
 */
export interface IdempotencyCheckResult {
  exists: boolean;
  payment?: ITransaction;
  shouldProcess: boolean;
}

/**
 * Interface for payment processing options
 */
export interface PaymentProcessingOptions {
  enableIdempotency: boolean;
  lockTimeoutMs: number;
  retryAttempts: number;
  publishToQueue: boolean;
}
