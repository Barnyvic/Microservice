import { Product } from '../models/Product';
import {
  NotFoundError,
  ValidationError,
} from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import { RedisClient } from '@shared/utils/redis-client';
import { CacheManager } from '@shared/utils/cache-manager';
import { RedisLockManager } from '@shared/utils/redis-lock-manager';
import type { Product as IProduct } from '@shared/types';
import env from '@shared/config/env';
import type {
  CreateProductData,
  UpdateProductData,
  ProductSearchOptions,
  PaginationOptions,
  ProductListResult,
} from '../interfaces';

export class ProductService {
  private redisClient: RedisClient;
  private cacheManager: CacheManager;
  private lockManager: RedisLockManager;

  constructor() {
    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'product-service:',
    });
    this.cacheManager = new CacheManager(this.redisClient, 600, 'products:');
    this.lockManager = new RedisLockManager(this.redisClient);
  }

  async initialize(): Promise<void> {
    await this.redisClient.connect();
  }

  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }

  async createProduct(
    data: CreateProductData,
    requestId?: string
  ): Promise<IProduct> {
    try {
      logger.info('Creating new product', {
        name: data.name,
        requestId,
      });

      const product = new Product(data);
      const savedProduct = await product.save();

      logger.info('Product created successfully', {
        productId: savedProduct.productId,
        name: savedProduct.name,
        requestId,
      });

      return savedProduct.toObject();
    } catch (error) {
      logger.error('Failed to create product', {
        error,
        name: data.name,
        requestId,
      });
      throw error;
    }
  }

  async getProductById(
    productId: string,
    requestId?: string
  ): Promise<IProduct> {
    try {
      logger.debug('Fetching product by ID', {
        productId,
        requestId,
      });

      const cached = await this.cacheManager.get<IProduct>(productId);
      if (cached) {
        logger.debug('Product found in cache', { productId, requestId });
        return cached;
      }

      const product = await Product.findOne({ productId });

      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      const result = product.toObject();

      await this.cacheManager.set(productId, result);

      return result;
    } catch (error) {
      logger.error('Failed to fetch product', {
        error,
        productId,
        requestId,
      });
      throw error;
    }
  }

  async updateProduct(
    productId: string,
    data: UpdateProductData,
    requestId?: string
  ): Promise<IProduct> {
    try {
      logger.info('Updating product', {
        productId,
        requestId,
      });

      const product = await Product.findOneAndUpdate({ productId }, data, {
        new: true,
        runValidators: true,
      });

      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      await this.redisClient.del(productId);

      logger.info('Product updated successfully', {
        productId,
        requestId,
      });

      return product.toObject();
    } catch (error) {
      logger.error('Failed to update product', {
        error,
        productId,
        requestId,
      });
      throw error;
    }
  }

  async deleteProduct(productId: string, requestId?: string): Promise<void> {
    try {
      logger.info('Deleting product', {
        productId,
        requestId,
      });

      const product = await Product.findOneAndUpdate(
        { productId },
        { isActive: false },
        { new: true }
      );

      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      logger.info('Product deleted successfully', {
        productId,
        requestId,
      });

      await this.redisClient.del(productId);
    } catch (error) {
      logger.error('Failed to delete product', {
        error,
        productId,
        requestId,
      });
      throw error;
    }
  }

  async listProducts(
    options: PaginationOptions & ProductSearchOptions,
    requestId?: string
  ): Promise<ProductListResult> {
    const { page, limit, ...searchOptions } = options;

    const cacheKey = `list:${JSON.stringify({
      page,
      limit,
      ...searchOptions,
    })}`;

    return this.cacheManager.getOrSet(
      cacheKey,
      async () => {
        logger.debug('Fetching products list from database', {
          options,
          requestId,
        });

        const skip = (page - 1) * limit;
        const query: Record<string, unknown> = {};

        if (searchOptions.category) {
          query.category = searchOptions.category;
        }

        if (searchOptions.brand) {
          query.brand = searchOptions.brand;
        }

        if (
          searchOptions.minPrice !== undefined ||
          searchOptions.maxPrice !== undefined
        ) {
          query.price = {};
          if (searchOptions.minPrice !== undefined) {
            (query.price as Record<string, unknown>).$gte =
              searchOptions.minPrice;
          }
          if (searchOptions.maxPrice !== undefined) {
            (query.price as Record<string, unknown>).$lte =
              searchOptions.maxPrice;
          }
        }

        if (searchOptions.search) {
          query.$text = { $search: searchOptions.search };
        }

        if (searchOptions.isActive !== undefined) {
          query.isActive = searchOptions.isActive;
        } else {
          query.isActive = true;
        }

        const [products, total] = await Promise.all([
          Product.find(query)
            .sort(
              searchOptions.search
                ? { score: { $meta: 'textScore' } }
                : { createdAt: -1 }
            )
            .skip(skip)
            .limit(limit)
            .lean(),
          Product.countDocuments(query),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
          products: products.map(product => {
            const { _id, __v, ...productData } = product;
            return productData as IProduct;
          }),
          total,
          page,
          limit,
          totalPages,
        };
      },
      { ttlSeconds: 120 }
    );
  }

  async checkAvailability(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<{ available: boolean; stock: number }> {
    const cacheKey = `availability:${productId}:${quantity}`;

    return this.cacheManager.getOrSet(
      cacheKey,
      async () => {
        logger.debug('Checking product availability from database', {
          productId,
          quantity,
          requestId,
        });

        const product = await Product.findOne({ productId, isActive: true });

        if (!product) {
          throw new NotFoundError('Product', productId);
        }

        const available = product.stock >= quantity;

        return {
          available,
          stock: product.stock,
        };
      },
      { ttlSeconds: 30 }
    );
  }

  async reserveStock(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<boolean> {
    const lockKey = `stock-reservation:${productId}`;
    const lockTtl = 30000;

    return this.lockManager.withLock(
      lockKey,
      async () => {
        return this.reserveStockInternal(productId, quantity, requestId);
      },
      { ttlMs: lockTtl },
      requestId
    );
  }

  private async reserveStockInternal(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<boolean> {
    try {
      logger.info('Reserving product stock', {
        productId,
        quantity,
        requestId,
      });

      if (quantity <= 0) {
        throw new ValidationError('Quantity must be greater than 0');
      }

      const result = await Product.updateOne(
        {
          productId,
          isActive: true,
          stock: { $gte: quantity },
        },
        {
          $inc: { stock: -quantity },
        }
      );

      const success = result.modifiedCount === 1;

      if (!success) {
        const product = await Product.findOne({ productId, isActive: true });

        if (!product) {
          throw new NotFoundError('Product', productId);
        }

        logger.warn('Failed to reserve stock - insufficient quantity', {
          productId,
          requestedQuantity: quantity,
          availableStock: product.stock,
          requestId,
        });
        return false;
      }

      logger.info('Stock reserved successfully', {
        productId,
        quantity,
        requestId,
      });

      await this.redisClient.del(`availability:${productId}:*`);

      return true;
    } catch (error) {
      logger.error('Failed to reserve stock', {
        error,
        productId,
        quantity,
        requestId,
      });
      throw error;
    }
  }

  async releaseStock(
    productId: string,
    quantity: number,
    requestId?: string
  ): Promise<void> {
    try {
      logger.info('Releasing product stock', {
        productId,
        quantity,
        requestId,
      });

      if (quantity <= 0) {
        throw new ValidationError('Quantity must be greater than 0');
      }

      const result = await Product.updateOne(
        { productId },
        { $inc: { stock: quantity } }
      );

      if (result.matchedCount === 0) {
        throw new NotFoundError('Product', productId);
      }

      logger.info('Stock released successfully', {
        productId,
        quantity,
        requestId,
      });

      await this.redisClient.del(`availability:${productId}:*`);
    } catch (error) {
      logger.error('Failed to release stock', {
        error,
        productId,
        quantity,
        requestId,
      });
      throw error;
    }
  }

  async getProductsByCategory(
    category: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<ProductListResult> {
    return this.listProducts(
      { ...options, category, isActive: true },
      requestId
    );
  }

  async getProductsByBrand(
    brand: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<ProductListResult> {
    return this.listProducts({ ...options, brand, isActive: true }, requestId);
  }

  async searchProducts(
    searchTerm: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<ProductListResult> {
    return this.listProducts(
      { ...options, search: searchTerm, isActive: true },
      requestId
    );
  }
}
