import { z } from 'zod';
import type { EnvConfig } from '../types';

/**
 * Environment variable validation schema
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(3000),
  MONGODB_URI: z
    .string()
    .url()
    .refine(
      (uri: string) =>
        uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
      {
        message: 'MONGODB_URI must be a valid MongoDB connection string',
      }
    ),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Redis configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0).max(15))
    .default(0),

  // Optional environment variables
  RABBITMQ_URI: z.string().url().optional(),
  CUSTOMER_SERVICE_URL: z.string().url().optional(),
  PRODUCT_SERVICE_URL: z.string().url().optional(),
  PAYMENT_SERVICE_URL: z.string().url().optional(),
  ORDER_SERVICE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  API_KEY: z.string().min(16).optional(),
});

/**
 * Validate and parse environment variables
 */
function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env) as EnvConfig;

    // Log configuration (without sensitive data)
    const safeConfig = { ...env };
    delete safeConfig.MONGODB_URI;
    delete safeConfig.RABBITMQ_URI;
    delete safeConfig.JWT_SECRET;
    delete safeConfig.API_KEY;

    // eslint-disable-next-line no-console
    console.log('Environment configuration loaded:', safeConfig);

    return env;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Environment validation failed:');

    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        // eslint-disable-next-line no-console
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    } else if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(error.message);
    }

    process.exit(1);
  }
}

export default validateEnv();
