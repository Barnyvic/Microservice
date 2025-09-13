import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import { validate } from '@shared/middleware/validation';
import { productSchemas, commonSchemas } from '@shared/middleware/validation';
import { z } from 'zod';

const router = Router();
const productController = new ProductController();


router.post(
  '/',
  validate({
    body: productSchemas.create,
  }),
  productController.createProduct
);


router.get(
  '/',
  validate({
    query: productSchemas.query,
  }),
  productController.listProducts
);


router.get(
  '/search',
  validate({
    query: commonSchemas.pagination.extend({
      q: z.string().min(1),
    }),
  }),
  productController.searchProducts
);


router.get(
  '/category/:category',
  validate({
    params: z.object({
      category: z.string().min(1).max(50),
    }),
    query: commonSchemas.pagination,
  }),
  productController.getProductsByCategory
);


router.get(
  '/brand/:brand',
  validate({
    params: z.object({
      brand: z.string().min(1).max(50),
    }),
    query: commonSchemas.pagination,
  }),
  productController.getProductsByBrand
);


router.get(
  '/:productId',
  validate({
    params: productSchemas.params,
  }),
  productController.getProduct
);


router.put(
  '/:productId',
  validate({
    params: productSchemas.params,
    body: productSchemas.update,
  }),
  productController.updateProduct
);


router.delete(
  '/:productId',
  validate({
    params: productSchemas.params,
  }),
  productController.deleteProduct
);


router.get(
  '/:productId/availability',
  validate({
    params: productSchemas.params,
    query: z.object({
      quantity: z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val, 10) : 1))
        .pipe(z.number().int().min(1)),
    }),
  }),
  productController.checkAvailability
);


router.post(
  '/:productId/reserve',
  validate({
    params: productSchemas.params,
    body: z.object({
      quantity: commonSchemas.quantity,
    }),
  }),
  productController.reserveStock
);


router.post(
  '/:productId/release',
  validate({
    params: productSchemas.params,
    body: z.object({
      quantity: commonSchemas.quantity,
    }),
  }),
  productController.releaseStock
);

export default router;




