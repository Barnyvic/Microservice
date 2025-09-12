


export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}


export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}


export enum AddressType {
  BILLING = 'billing',
  SHIPPING = 'shipping',
  BOTH = 'both',
}


export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}


export enum CommunicationPreference {
  EMAIL = 'email',
  SMS = 'sms',
  PHONE = 'phone',
  NONE = 'none',
}

