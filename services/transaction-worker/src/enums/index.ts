


export enum MessageProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DEAD_LETTER = 'dead_letter',
}


export enum WorkerOperation {
  SAVE_TRANSACTION = 'save_transaction',
  UPDATE_TRANSACTION = 'update_transaction',
  SEND_NOTIFICATION = 'send_notification',
  AUDIT_LOG = 'audit_log',
}


export enum MessagePriority {
  LOW = 0,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15,
}


export enum ErrorHandlingStrategy {
  RETRY = 'retry',
  DEAD_LETTER = 'dead_letter',
  IGNORE = 'ignore',
  ALERT = 'alert',
}


export enum WorkerHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  STOPPED = 'stopped',
}


export enum TransactionEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

