import type { Customer as ICustomer } from '@shared/types';

/**
 * Interface for creating a new customer
 */
export interface CreateCustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

/**
 * Interface for updating customer data
 */
export interface UpdateCustomerData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface for customer list result with pagination
 */
export interface CustomerListResult {
  customers: ICustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for customer search filters
 */
export interface CustomerSearchFilters {
  email?: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Interface for customer service configuration
 */
export interface CustomerServiceConfig {
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  redisKeyPrefix: string;
}
