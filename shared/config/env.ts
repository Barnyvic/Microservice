import { z } from 'zod';
import type { EnvConfig } from '../types';

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

  RABBITMQ_URI: z.string().url().optional(),
  CUSTOMER_SERVICE_URL: z.string().url().optional(),
  PRODUCT_SERVICE_URL: z.string().url().optional(),
  PAYMENT_SERVICE_URL: z.string().url().optional(),
  ORDER_SERVICE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  API_KEY: z.string().min(16).optional(),
});

function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env) as EnvConfig;

    const safeConfig = { ...env };
    delete (safeConfig as any).MONGODB_URI;
    delete (safeConfig as any).RABBITMQ_URI;
    delete (safeConfig as any).JWT_SECRET;
    delete (safeConfig as any).API_KEY;

    console.log('Environment configuration loaded:', safeConfig);

    return env;
  } catch (error) {
    console.error('Environment validation failed:');

    if (error instanceof z.ZodError) {
      error.issues.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    } else if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
}

export default validateEnv();
