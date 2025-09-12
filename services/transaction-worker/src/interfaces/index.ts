import type { TransactionEvent } from '@shared/types';

/**
 * Interface for worker status
 */
export interface WorkerStatus {
  connected: boolean;
  processing: boolean;
  queueName: string;
  exchangeName: string;
}

/**
 * Interface for message processing result
 */
export interface MessageProcessingResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  retryCount: number;
  messageId: string;
}

/**
 * Interface for worker configuration
 */
export interface WorkerConfig {
  exchangeName: string;
  queueName: string;
  routingKey: string;
  maxRetries: number;
  retryDelayMs: number;
  deadLetterExchange?: string;
  deadLetterQueue?: string;
}

/**
 * Interface for message metadata
 */
export interface MessageMetadata {
  messageId: string;
  retryCount: number;
  timestamp: Date;
  deliveryTag: number;
}

/**
 * Interface for transaction processing context
 */
export interface TransactionProcessingContext {
  transactionEvent: TransactionEvent;
  metadata: MessageMetadata;
  requestId?: string;
}

/**
 * Interface for worker statistics
 */
export interface WorkerStatistics {
  messagesProcessed: number;
  messagesSucceeded: number;
  messagesFailed: number;
  messagesRetried: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
  uptime: number;
}

/**
 * Interface for error handling configuration
 */
export interface ErrorHandlingConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  deadLetterEnabled: boolean;
  alertOnFailure: boolean;
}
