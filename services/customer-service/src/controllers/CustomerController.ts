import type { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { asyncHandler } from '@shared/middleware/error-handler';
import { logger } from '@shared/utils/logger';

interface ExtendedRequest extends Request {
  requestId?: string;
}

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  /**
   * Create a new customer
   */
  createCustomer = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const customer = await this.customerService.createCustomer(
      req.body,
      req.requestId
    );

    logger.info('Customer created via API', {
      customerId: customer.customerId,
      requestId: req.requestId,
    });

    res.status(201).json({
      success: true,
      data: customer,
    });
  });

  /**
   * Get customer by ID
   */
  getCustomer = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { customerId } = req.params;

    const customer = await this.customerService.getCustomerById(
      customerId,
      req.requestId
    );

    res.json({
      success: true,
      data: customer,
    });
  });

  /**
   * Update customer
   */
  updateCustomer = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { customerId } = req.params;

    const customer = await this.customerService.updateCustomer(
      customerId,
      req.body,
      req.requestId
    );

    logger.info('Customer updated via API', {
      customerId,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: customer,
    });
  });

  /**
   * Delete customer
   */
  deleteCustomer = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { customerId } = req.params;

    await this.customerService.deleteCustomer(customerId, req.requestId);

    logger.info('Customer deleted via API', {
      customerId,
      requestId: req.requestId,
    });

    res.status(204).send();
  });

  /**
   * List customers with pagination
   */
  listCustomers = asyncHandler(async (req: ExtendedRequest, res: Response) => {
    const { page = 1, limit = 10 } = req.query;

    const result = await this.customerService.listCustomers(
      {
        page: Number(page),
        limit: Number(limit),
      },
      req.requestId
    );

    res.json({
      success: true,
      data: result.customers,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * Search customers
   */
  searchCustomers = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { q: searchTerm, page = 1, limit = 10 } = req.query;

      if (!searchTerm || typeof searchTerm !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search term is required',
        });
      }

      const result = await this.customerService.searchCustomers(
        searchTerm,
        {
          page: Number(page),
          limit: Number(limit),
        },
        req.requestId
      );

      res.json({
        success: true,
        data: result.customers,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    }
  );

  /**
   * Get customer by email (internal endpoint)
   */
  getCustomerByEmail = asyncHandler(
    async (req: ExtendedRequest, res: Response) => {
      const { email } = req.params;

      const customer = await this.customerService.getCustomerByEmail(
        email,
        req.requestId
      );

      res.json({
        success: true,
        data: customer,
      });
    }
  );
}
