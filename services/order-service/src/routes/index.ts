import { Router } from 'express';
import { z } from 'zod';
import { OrderController } from '../controllers/OrderController';
import { validate } from '@shared/middleware/validation';
import { orderSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const orderController = new OrderController();

router.post(
  '/',
  validate({
    body: orderSchemas.create,
  }),
  orderController.createOrder
);

router.get(
  '/',
  validate({
    query: orderSchemas.query,
  }),
  orderController.listOrders
);

router.get(
  '/customer/:customerId',
  validate({
    params: z.object({
      customerId: z.string().min(1).max(50),
    }) as any,
    query: commonSchemas.pagination,
  }) as any,
  orderController.getOrdersByCustomer
);

router.get(
  '/:orderId',
  validate({
    params: orderSchemas.params,
  }),
  orderController.getOrder
);

router.put(
  '/:orderId',
  validate({
    params: orderSchemas.params,
    body: orderSchemas.update,
  }),
  orderController.updateOrder
);

router.post(
  '/:orderId/cancel',
  validate({
    params: orderSchemas.params,
  }),
  orderController.cancelOrder
);

export default router;
