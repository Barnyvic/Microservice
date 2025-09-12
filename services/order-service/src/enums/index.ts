


export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}


export enum FulfillmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
}


export enum OrderSource {
  WEB = 'web',
  MOBILE_APP = 'mobile_app',
  API = 'api',
  ADMIN = 'admin',
  PHONE = 'phone',
}


export enum OrderValidationError {
  CUSTOMER_NOT_FOUND = 'customer_not_found',
  PRODUCT_NOT_FOUND = 'product_not_found',
  INSUFFICIENT_STOCK = 'insufficient_stock',
  INVALID_QUANTITY = 'invalid_quantity',
  INVALID_AMOUNT = 'invalid_amount',
  PRODUCT_INACTIVE = 'product_inactive',
}


export enum CancellationReason {
  CUSTOMER_REQUEST = 'customer_request',
  PAYMENT_FAILED = 'payment_failed',
  OUT_OF_STOCK = 'out_of_stock',
  FRAUD_DETECTED = 'fraud_detected',
  SYSTEM_ERROR = 'system_error',
  ADMIN_CANCELLED = 'admin_cancelled',
}

