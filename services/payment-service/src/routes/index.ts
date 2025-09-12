import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { validate } from '@shared/middleware/validation';
import { paymentSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const paymentController = new PaymentController();

/**
 * @route POST /api/v1/payments/process
 * @desc Process payment (called by order service)
 * @access Internal
 * @flow Follows the diagram: receive payment request -> process -> publish to RabbitMQ
 */
router.post(
  '/process',
  validate({
    body: paymentSchemas.process,
  }),
  paymentController.processPayment
);

/**
 * @route GET /api/v1/payments
 * @desc Get all payments with pagination and filtering
 * @access Public
 */
router.get(
  '/',
  validate({
    query: paymentSchemas.query,
  }),
  paymentController.listPayments
);

/**
 * @route GET /api/v1/payments/order/:orderId
 * @desc Get payments by order ID
 * @access Public
 */
router.get(
  '/order/:orderId',
  validate({
    params: {
      orderId: commonSchemas.customId,
    },
  }),
  paymentController.getPaymentsByOrder
);

/**
 * @route GET /api/v1/payments/customer/:customerId
 * @desc Get payments by customer ID
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
  paymentController.getPaymentsByCustomer
);

/**
 * @route GET /api/v1/payments/queue/status
 * @desc Get message queue connection status
 * @access Internal
 */
router.get('/queue/status', paymentController.getMessageQueueStatus);

/**
 * @route GET /api/v1/payments/:transactionId
 * @desc Get payment by transaction ID
 * @access Public
 */
router.get(
  '/:transactionId',
  validate({
    params: paymentSchemas.params,
  }),
  paymentController.getPayment
);

export default router;
