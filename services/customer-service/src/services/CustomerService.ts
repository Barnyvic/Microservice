import { Customer, type CustomerDocument } from '../models/Customer';
import { NotFoundError, ConflictError } from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';
import { RedisClient } from '@shared/utils/redis-client';
import { CacheManager } from '@shared/utils/cache-manager';
import type { Customer as ICustomer } from '@shared/types';
import env from '@shared/config/env';
import type {
  CreateCustomerData,
  UpdateCustomerData,
  PaginationOptions,
  CustomerListResult,
  CustomerSearchFilters,
  CustomerServiceConfig,
} from '../interfaces';

export class CustomerService {
  private redisClient: RedisClient;
  private cacheManager: CacheManager;

  constructor() {
    this.redisClient = new RedisClient({
      host: env.REDIS_HOST!,
      port: env.REDIS_PORT!,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB!,
      keyPrefix: 'customer-service:',
    });
    this.cacheManager = new CacheManager(this.redisClient, 300, 'customers:'); // 5 minute cache
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    await this.redisClient.connect();
  }

  /**
   * Disconnect Redis
   */
  async disconnect(): Promise<void> {
    await this.redisClient.disconnect();
  }

  /**
   * Create a new customer
   */
  async createCustomer(
    data: CreateCustomerData,
    requestId?: string
  ): Promise<ICustomer> {
    try {
      logger.info('Creating new customer', {
        email: data.email,
        requestId,
      });

      // Check if customer with email already exists
      const existingCustomer = await Customer.findOne({
        email: data.email,
      });

      if (existingCustomer) {
        throw new ConflictError('Customer with this email already exists', {
          email: data.email,
        });
      }

      const customer = new Customer(data);
      const savedCustomer = await customer.save();

      logger.info('Customer created successfully', {
        customerId: savedCustomer.customerId,
        email: savedCustomer.email,
        requestId,
      });

      const customerObj = savedCustomer.toObject();

      // Cache the new customer
      await this.cacheManager.set(`id:${customerObj.customerId}`, customerObj, {
        ttlSeconds: 300,
      });
      await this.cacheManager.set(`email:${customerObj.email}`, customerObj, {
        ttlSeconds: 300,
      });

      // Invalidate list cache
      await this.cacheManager.invalidatePattern('list:*');

      return customerObj;
    } catch (error) {
      logger.error('Failed to create customer', {
        error,
        email: data.email,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Get customer by ID with caching
   */
  async getCustomerById(
    customerId: string,
    requestId?: string
  ): Promise<ICustomer> {
    return this.cacheManager.getOrSet(
      `id:${customerId}`,
      async () => {
        logger.debug('Fetching customer by ID from database', {
          customerId,
          requestId,
        });

        const customer = await Customer.findOne({ customerId });

        if (!customer) {
          throw new NotFoundError('Customer', customerId);
        }

        return customer.toObject();
      },
      { ttlSeconds: 300 }
    );
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(
    email: string,
    requestId?: string
  ): Promise<ICustomer> {
    try {
      logger.debug('Fetching customer by email', {
        email,
        requestId,
      });

      const customer = await Customer.findOne({ email });

      if (!customer) {
        throw new NotFoundError('Customer', email);
      }

      return customer.toObject();
    } catch (error) {
      logger.error('Failed to fetch customer by email', {
        error,
        email,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: UpdateCustomerData,
    requestId?: string
  ): Promise<ICustomer> {
    try {
      logger.info('Updating customer', {
        customerId,
        requestId,
      });

      // If email is being updated, check for conflicts
      if (data.email) {
        const existingCustomer = await Customer.findOne({
          email: data.email,
          customerId: { $ne: customerId },
        });

        if (existingCustomer) {
          throw new ConflictError(
            'Another customer with this email already exists',
            { email: data.email }
          );
        }
      }

      const customer = await Customer.findOneAndUpdate({ customerId }, data, {
        new: true,
        runValidators: true,
      });

      if (!customer) {
        throw new NotFoundError('Customer', customerId);
      }

      logger.info('Customer updated successfully', {
        customerId,
        requestId,
      });

      return customer.toObject();
    } catch (error) {
      logger.error('Failed to update customer', {
        error,
        customerId,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(customerId: string, requestId?: string): Promise<void> {
    try {
      logger.info('Deleting customer', {
        customerId,
        requestId,
      });

      const customer = await Customer.findOneAndDelete({ customerId });

      if (!customer) {
        throw new NotFoundError('Customer', customerId);
      }

      logger.info('Customer deleted successfully', {
        customerId,
        requestId,
      });
    } catch (error) {
      logger.error('Failed to delete customer', {
        error,
        customerId,
        requestId,
      });
      throw error;
    }
  }

  /**
   * List customers with pagination
   */
  async listCustomers(
    options: PaginationOptions,
    requestId?: string
  ): Promise<CustomerListResult> {
    try {
      logger.debug('Listing customers', {
        options,
        requestId,
      });

      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [customers, total] = await Promise.all([
        Customer.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Customer.countDocuments(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        customers: customers.map(customer => {
          const { _id, __v, ...customerData } = customer;
          return customerData as ICustomer;
        }),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Failed to list customers', {
        error,
        options,
        requestId,
      });
      throw error;
    }
  }

  /**
   * Search customers by criteria
   */
  async searchCustomers(
    searchTerm: string,
    options: PaginationOptions,
    requestId?: string
  ): Promise<CustomerListResult> {
    try {
      logger.debug('Searching customers', {
        searchTerm,
        options,
        requestId,
      });

      const { page, limit } = options;
      const skip = (page - 1) * limit;

      // Create search query
      const searchQuery = {
        $or: [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { 'address.city': { $regex: searchTerm, $options: 'i' } },
          { 'address.state': { $regex: searchTerm, $options: 'i' } },
        ],
      };

      const [customers, total] = await Promise.all([
        Customer.find(searchQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Customer.countDocuments(searchQuery),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        customers: customers.map(customer => {
          const { _id, __v, ...customerData } = customer;
          return customerData as ICustomer;
        }),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Failed to search customers', {
        error,
        searchTerm,
        options,
        requestId,
      });
      throw error;
    }
  }
}
