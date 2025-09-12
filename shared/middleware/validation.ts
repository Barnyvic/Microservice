import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './error-handler';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}


export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      if (schemas.headers) {
        req.headers = schemas.headers.parse(req.headers);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationDetails = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw new ValidationError('Request validation failed', {
          errors: validationDetails,
        });
      }
      throw error;
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),

  // Custom ID validation (for our custom IDs like customerId, productId, etc.)
  customId: z.string().min(1).max(50),

  // Email validation
  email: z.string().email('Invalid email format'),

  // Phone validation (basic)
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format'),

  // Pagination
  pagination: z.object({
    page: z
      .string()
      .optional()
      .transform(val => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1).max(1000)),
    limit: z
      .string()
      .optional()
      .transform(val => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().min(1).max(100)),
  }),

  // Amount validation (in cents)
  amount: z.number().int().min(0),

  // Quantity validation
  quantity: z.number().int().min(1),
};

// Request ID header validation
export const requestIdSchema = z.object({
  'x-request-id': z.string().optional(),
});

// Customer validation schemas
export const customerSchemas = {
  create: z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    email: commonSchemas.email,
    phone: commonSchemas.phone,
    address: z.object({
      street: z.string().min(1).max(100),
      city: z.string().min(1).max(50),
      state: z.string().min(1).max(50),
      zipCode: z.string().min(1).max(20),
      country: z.string().min(1).max(50),
    }),
  }),

  update: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    email: commonSchemas.email.optional(),
    phone: commonSchemas.phone.optional(),
    address: z
      .object({
        street: z.string().min(1).max(100),
        city: z.string().min(1).max(50),
        state: z.string().min(1).max(50),
        zipCode: z.string().min(1).max(20),
        country: z.string().min(1).max(50),
      })
      .optional(),
  }),

  params: z.object({
    customerId: commonSchemas.customId,
  }),
};

// Product validation schemas
export const productSchemas = {
  create: z.object({
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    price: commonSchemas.amount,
    category: z.string().min(1).max(50),
    brand: z.string().min(1).max(50),
    stock: z.number().int().min(0),
    specifications: z.record(z.unknown()),
    images: z.array(z.string().url()).optional(),
    weight: z.number().positive(),
    dimensions: z.object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    }),
  }),

  update: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(1000).optional(),
    price: commonSchemas.amount.optional(),
    category: z.string().min(1).max(50).optional(),
    brand: z.string().min(1).max(50).optional(),
    stock: z.number().int().min(0).optional(),
    specifications: z.record(z.unknown()).optional(),
    images: z.array(z.string().url()).optional(),
    weight: z.number().positive().optional(),
    dimensions: z
      .object({
        length: z.number().positive(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .optional(),
    isActive: z.boolean().optional(),
  }),

  params: z.object({
    productId: commonSchemas.customId,
  }),

  query: z
    .object({
      category: z.string().optional(),
      brand: z.string().optional(),
      minPrice: z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val, 10) : undefined)),
      maxPrice: z
        .string()
        .optional()
        .transform(val => (val ? parseInt(val, 10) : undefined)),
      search: z.string().optional(),
    })
    .merge(commonSchemas.pagination),
};

// Order validation schemas
export const orderSchemas = {
  create: z.object({
    customerId: commonSchemas.customId,
    productId: commonSchemas.customId,
    quantity: commonSchemas.quantity,
  }),

  update: z.object({
    quantity: commonSchemas.quantity.optional(),
    orderStatus: z
      .enum(['pending', 'processing', 'completed', 'cancelled', 'failed'])
      .optional(),
  }),

  params: z.object({
    orderId: commonSchemas.customId,
  }),

  query: z
    .object({
      customerId: commonSchemas.customId.optional(),
      status: z
        .enum(['pending', 'processing', 'completed', 'cancelled', 'failed'])
        .optional(),
    })
    .merge(commonSchemas.pagination),
};

// Payment validation schemas
export const paymentSchemas = {
  process: z.object({
    customerId: commonSchemas.customId,
    orderId: commonSchemas.customId,
    amount: commonSchemas.amount,
  }),

  params: z.object({
    transactionId: commonSchemas.customId,
  }),

  query: z
    .object({
      customerId: commonSchemas.customId.optional(),
      orderId: commonSchemas.customId.optional(),
      status: z
        .enum(['pending', 'processing', 'completed', 'failed', 'refunded'])
        .optional(),
    })
    .merge(commonSchemas.pagination),
};


