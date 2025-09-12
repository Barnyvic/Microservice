import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { validate } from '@shared/middleware/validation';
import { orderSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const orderController = new OrderController();

/**
 * @route POST /api/v1/orders
 * @desc Create a new order
 * @access Public
 * @flow Follows the diagram: validate order -> create order -> initiate payment
 */
router.post(
  '/',
  validate({
    body: orderSchemas.create,
  }),
  orderController.createOrder
);

/**
 * @route GET /api/v1/orders
 * @desc Get all orders with pagination and filtering
 * @access Public
 */
router.get(
  '/',
  validate({
    query: orderSchemas.query,
  }),
  orderController.listOrders
);

/**
 * @route GET /api/v1/orders/customer/:customerId
 * @desc Get orders by customer ID
 * @access Public
 */
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

/**
 * @route GET /api/v1/orders/:orderId
 * @desc Get order by ID
 * @access Public
 */
router.get(
  '/:orderId',
  validate({
    params: orderSchemas.params,
  }),
  orderController.getOrder
);

/**
 * @route PUT /api/v1/orders/:orderId
 * @desc Update order
 * @access Public
 */
router.put(
  '/:orderId',
  validate({
    params: orderSchemas.params,
    body: orderSchemas.update,
  }),
  orderController.updateOrder
);

/**
 * @route POST /api/v1/orders/:orderId/cancel
 * @desc Cancel order
 * @access Public
 */
router.post(
  '/:orderId/cancel',
  validate({
    params: orderSchemas.params,
  }),
  orderController.cancelOrder
);

export default router;
