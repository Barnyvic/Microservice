import type { Product as IProduct } from '@shared/types';

/**
 * Interface for creating a new product
 */
export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  stock: number;
  specifications?: Record<string, unknown>;
  images?: string[];
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
}

/**
 * Interface for updating product data
 */
export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  brand?: string;
  stock?: number;
  specifications?: Record<string, unknown>;
  images?: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive?: boolean;
}

/**
 * Interface for product search options
 */
export interface ProductSearchOptions {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  isActive?: boolean;
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Interface for product list result with pagination
 */
export interface ProductListResult {
  products: IProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for product availability check
 */
export interface ProductAvailability {
  available: boolean;
  stock: number;
}

/**
 * Interface for stock reservation request
 */
export interface StockReservationRequest {
  productId: string;
  quantity: number;
  requestId?: string;
}

/**
 * Interface for extended request with requestId
 */
export interface ExtendedRequest {
  requestId?: string;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
}
