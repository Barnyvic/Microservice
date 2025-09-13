import type {
  Transaction as ITransaction,
  TransactionStatus,
} from '@shared/types';

export interface ProcessPaymentData {
  customerId: string;
  orderId: string;
  amount: number;
  productId?: string;
  idempotencyKey?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: TransactionStatus;
  error?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaymentListResult {
  payments: ITransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentSearchFilters {
  customerId?: string;
  orderId?: string;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface ExtendedRequest {
  requestId?: string;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

export interface MessageQueueStatus {
  connected: boolean;
  exchangeName: string;
  routingKey: string;
  lastPublishedAt?: Date;
  publishCount: number;
  errorCount: number;
}

export interface IdempotencyCheckResult {
  exists: boolean;
  payment?: ITransaction;
  shouldProcess: boolean;
}

export interface PaymentProcessingOptions {
  enableIdempotency: boolean;
  lockTimeoutMs: number;
  retryAttempts: number;
  publishToQueue: boolean;
}
