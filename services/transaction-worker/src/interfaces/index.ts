import type { TransactionEvent } from '@shared/types';


export interface WorkerStatus {
  connected: boolean;
  processing: boolean;
  queueName: string;
  exchangeName: string;
}


export interface MessageProcessingResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  retryCount: number;
  messageId: string;
}


export interface WorkerConfig {
  exchangeName: string;
  queueName: string;
  routingKey: string;
  maxRetries: number;
  retryDelayMs: number;
  deadLetterExchange?: string;
  deadLetterQueue?: string;
}


export interface MessageMetadata {
  messageId: string;
  retryCount: number;
  timestamp: Date;
  deliveryTag: number;
}


export interface TransactionProcessingContext {
  transactionEvent: TransactionEvent;
  metadata: MessageMetadata;
  requestId?: string;
}


export interface WorkerStatistics {
  messagesProcessed: number;
  messagesSucceeded: number;
  messagesFailed: number;
  messagesRetried: number;
  averageProcessingTime: number;
  lastProcessedAt?: Date;
  uptime: number;
}


export interface ErrorHandlingConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  deadLetterEnabled: boolean;
  alertOnFailure: boolean;
}

