import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { validate } from '@shared/middleware/validation';
import { customerSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const customerController = new CustomerController();


router.post(
  '/',
  validate({
    body: customerSchemas.create,
  }),
  customerController.createCustomer
);


router.get(
  '/',
  validate({
    query: commonSchemas.pagination,
  }),
  customerController.listCustomers
);


router.get(
  '/search',
  validate({
    query: commonSchemas.pagination.extend({
      q: commonSchemas.customId,
    }),
  }),
  customerController.searchCustomers
);


router.get(
  '/email/:email',
  validate({
    params: {
      email: commonSchemas.email,
    },
  }),
  customerController.getCustomerByEmail
);


router.get(
  '/:customerId',
  validate({
    params: customerSchemas.params,
  }),
  customerController.getCustomer
);


router.put(
  '/:customerId',
  validate({
    params: customerSchemas.params,
    body: customerSchemas.update,
  }),
  customerController.updateCustomer
);


router.delete(
  '/:customerId',
  validate({
    params: customerSchemas.params,
  }),
  customerController.deleteCustomer
);

export default router;


