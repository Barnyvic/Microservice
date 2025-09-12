import { Router } from 'express';
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
    params: {
      customerId: commonSchemas.customId,
    },
    query: commonSchemas.pagination,
  }),
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



