/**
 * Order service specific enums
 */

/**
 * Order priority levels
 */
export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Order fulfillment status
 */
export enum FulfillmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
}

/**
 * Order source tracking
 */
export enum OrderSource {
  WEB = 'web',
  MOBILE_APP = 'mobile_app',
  API = 'api',
  ADMIN = 'admin',
  PHONE = 'phone',
}

/**
 * Order validation error types
 */
export enum OrderValidationError {
  CUSTOMER_NOT_FOUND = 'customer_not_found',
  PRODUCT_NOT_FOUND = 'product_not_found',
  INSUFFICIENT_STOCK = 'insufficient_stock',
  INVALID_QUANTITY = 'invalid_quantity',
  INVALID_AMOUNT = 'invalid_amount',
  PRODUCT_INACTIVE = 'product_inactive',
}

/**
 * Order cancellation reasons
 */
export enum CancellationReason {
  CUSTOMER_REQUEST = 'customer_request',
  PAYMENT_FAILED = 'payment_failed',
  OUT_OF_STOCK = 'out_of_stock',
  FRAUD_DETECTED = 'fraud_detected',
  SYSTEM_ERROR = 'system_error',
  ADMIN_CANCELLED = 'admin_cancelled',
}
