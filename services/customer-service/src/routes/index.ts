import { Router } from 'express';
import { z } from 'zod';
import { CustomerController } from '../controllers/CustomerController';
import { validate } from '@shared/middleware/validation';
import { customerSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const customerController = new CustomerController();

router.post(
  '/',
  validate({
    body: customerSchemas.create,
  }) as any,
  customerController.createCustomer as any
);

router.get(
  '/',
  validate({
    query: commonSchemas.pagination,
  }) as any,
  customerController.listCustomers as any
);

router.get(
  '/search',
  validate({
    query: commonSchemas.pagination.extend({
      q: commonSchemas.customId,
    }),
  }) as any,
  customerController.searchCustomers as any
);

router.get(
  '/email/:email',
  validate({
    params: z.object({
      email: z.string().email(),
    }) as any,
  }) as any,
  customerController.getCustomerByEmail as any
);

router.get(
  '/:customerId',
  validate({
    params: customerSchemas.params,
  }) as any,
  customerController.getCustomer as any
);

router.put(
  '/:customerId',
  validate({
    params: customerSchemas.params,
    body: customerSchemas.update,
  }) as any,
  customerController.updateCustomer as any
);

router.delete(
  '/:customerId',
  validate({
    params: customerSchemas.params,
  }) as any,
  customerController.deleteCustomer as any
);

export default router;

