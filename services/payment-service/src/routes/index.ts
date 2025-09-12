import { Router } from 'express';
import { PaymentController } from '../controllers/PaymentController';
import { validate } from '@shared/middleware/validation';
import { paymentSchemas, commonSchemas } from '@shared/middleware/validation';

const router = Router();
const paymentController = new PaymentController();

router.post(
  '/process',
  validate({
    body: paymentSchemas.process,
  }),
  paymentController.processPayment
);

router.get(
  '/',
  validate({
    query: paymentSchemas.query,
  }),
  paymentController.listPayments
);

router.get(
  '/order/:orderId',
  validate({
    params: {
      orderId: commonSchemas.customId,
    },
  }),
  paymentController.getPaymentsByOrder
);

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

router.get('/queue/status', paymentController.getMessageQueueStatus);

router.get(
  '/:transactionId',
  validate({
    params: paymentSchemas.params,
  }),
  paymentController.getPayment
);

export default router;
