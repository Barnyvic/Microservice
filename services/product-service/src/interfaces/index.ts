import type { Product as IProduct } from '@shared/types';


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


export interface ProductSearchOptions {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  isActive?: boolean;
}


export interface PaginationOptions {
  page: number;
  limit: number;
}


export interface ProductListResult {
  products: IProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export interface ProductAvailability {
  available: boolean;
  stock: number;
}


export interface StockReservationRequest {
  productId: string;
  quantity: number;
  requestId?: string;
}


export interface ExtendedRequest {
  requestId?: string;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
}

