import type { Customer as ICustomer } from '@shared/types';


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


export interface PaginationOptions {
  page: number;
  limit: number;
}


export interface CustomerListResult {
  customers: ICustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export interface CustomerSearchFilters {
  email?: string;
  city?: string;
  state?: string;
  country?: string;
}


export interface CustomerServiceConfig {
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  redisKeyPrefix: string;
}

