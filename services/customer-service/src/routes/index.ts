import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { validate } from '@shared/middleware/validation';
import { customerSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const customerController = new CustomerController();

/**
 * @route POST /api/v1/customers
 * @desc Create a new customer
 * @access Public
 */
router.post(
  '/',
  validate({
    body: customerSchemas.create,
  }),
  customerController.createCustomer
);

/**
 * @route GET /api/v1/customers
 * @desc Get all customers with pagination
 * @access Public
 */
router.get(
  '/',
  validate({
    query: commonSchemas.pagination,
  }),
  customerController.listCustomers
);

/**
 * @route GET /api/v1/customers/search
 * @desc Search customers
 * @access Public
 */
router.get(
  '/search',
  validate({
    query: commonSchemas.pagination.extend({
      q: commonSchemas.customId,
    }),
  }),
  customerController.searchCustomers
);

/**
 * @route GET /api/v1/customers/email/:email
 * @desc Get customer by email (internal use)
 * @access Internal
 */
router.get(
  '/email/:email',
  validate({
    params: {
      email: commonSchemas.email,
    },
  }),
  customerController.getCustomerByEmail
);

/**
 * @route GET /api/v1/customers/:customerId
 * @desc Get customer by ID
 * @access Public
 */
router.get(
  '/:customerId',
  validate({
    params: customerSchemas.params,
  }),
  customerController.getCustomer
);

/**
 * @route PUT /api/v1/customers/:customerId
 * @desc Update customer
 * @access Public
 */
router.put(
  '/:customerId',
  validate({
    params: customerSchemas.params,
    body: customerSchemas.update,
  }),
  customerController.updateCustomer
);

/**
 * @route DELETE /api/v1/customers/:customerId
 * @desc Delete customer
 * @access Public
 */
router.delete(
  '/:customerId',
  validate({
    params: customerSchemas.params,
  }),
  customerController.deleteCustomer
);

export default router;
