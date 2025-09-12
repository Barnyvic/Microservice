/**
 * Customer service specific enums
 */

/**
 * Customer status enum for future use
 */
export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

/**
 * Customer type enum for business vs individual customers
 */
export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

/**
 * Address type enum
 */
export enum AddressType {
  BILLING = 'billing',
  SHIPPING = 'shipping',
  BOTH = 'both',
}

/**
 * Customer verification status
 */
export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/**
 * Customer communication preferences
 */
export enum CommunicationPreference {
  EMAIL = 'email',
  SMS = 'sms',
  PHONE = 'phone',
  NONE = 'none',
}
