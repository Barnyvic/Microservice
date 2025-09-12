/**
 * Payment service specific enums
 */

/**
 * Payment method types
 */
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto',
  DEMO_PAYMENT = 'demo_payment',
}

/**
 * Payment gateway providers
 */
export enum PaymentGateway {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square',
  DEMO = 'demo',
}

/**
 * Payment failure reasons
 */
export enum PaymentFailureReason {
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  INVALID_CARD = 'invalid_card',
  EXPIRED_CARD = 'expired_card',
  DECLINED_BY_BANK = 'declined_by_bank',
  FRAUD_DETECTED = 'fraud_detected',
  NETWORK_ERROR = 'network_error',
  GATEWAY_ERROR = 'gateway_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Refund status
 */
export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Currency codes (ISO 4217)
 */
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  CAD = 'CAD',
  AUD = 'AUD',
}

/**
 * Payment processing priority
 */
export enum PaymentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}
