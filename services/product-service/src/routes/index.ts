import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import { validate } from '@shared/middleware/validation';
import { productSchemas, commonSchemas } from '@shared/middleware/validation';
import { z } from 'zod';

const router = Router();
const productController = new ProductController();

/**
 * @route POST /api/v1/products
 * @desc Create a new product
 * @access Public
 */
router.post(
  '/',
  validate({
    body: productSchemas.create,
  }),
  productController.createProduct
);

/**
 * @route GET /api/v1/products
 * @desc Get all products with pagination and filtering
 * @access Public
 */
router.get(
  '/',
  validate({
    query: productSchemas.query,
  }),
  productController.listProducts
);

/**
 * @route GET /api/v1/products/search
 * @desc Search products
 * @access Public
 */
router.get(
  '/search',
  validate({
    query: commonSchemas.pagination.extend({
      q: z.string().min(1),
    }),
  }),
  productController.searchProducts
);

/**
 * @route GET /api/v1/products/category/:category
 * @desc Get products by category
 * @access Public
 */
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

/**
 * @route GET /api/v1/products/brand/:brand
 * @desc Get products by brand
 * @access Public
 */
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

/**
 * @route GET /api/v1/products/:productId
 * @desc Get product by ID
 * @access Public
 */
router.get(
  '/:productId',
  validate({
    params: productSchemas.params,
  }),
  productController.getProduct
);

/**
 * @route PUT /api/v1/products/:productId
 * @desc Update product
 * @access Public
 */
router.put(
  '/:productId',
  validate({
    params: productSchemas.params,
    body: productSchemas.update,
  }),
  productController.updateProduct
);

/**
 * @route DELETE /api/v1/products/:productId
 * @desc Delete product
 * @access Public
 */
router.delete(
  '/:productId',
  validate({
    params: productSchemas.params,
  }),
  productController.deleteProduct
);

/**
 * @route GET /api/v1/products/:productId/availability
 * @desc Check product availability
 * @access Public
 */
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

/**
 * @route POST /api/v1/products/:productId/reserve
 * @desc Reserve product stock (internal endpoint)
 * @access Internal
 */
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

/**
 * @route POST /api/v1/products/:productId/release
 * @desc Release reserved stock (internal endpoint)
 * @access Internal
 */
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
