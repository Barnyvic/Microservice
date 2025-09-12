/**
 * Shared enums used across multiple services
 */

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, calls fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

/**
 * Environment types
 */
export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
  STAGING = 'staging',
}

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * HTTP status categories
 */
export enum HttpStatusCategory {
  SUCCESS = 'success',
  CLIENT_ERROR = 'client_error',
  SERVER_ERROR = 'server_error',
  REDIRECT = 'redirect',
}

/**
 * Cache strategies
 */
export enum CacheStrategy {
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
  CACHE_ASIDE = 'cache_aside',
  REFRESH_AHEAD = 'refresh_ahead',
}

/**
 * Rate limiting strategies
 */
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  LEAKY_BUCKET = 'leaky_bucket',
}

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

/**
 * Service types
 */
export enum ServiceType {
  WEB_SERVICE = 'web_service',
  WORKER_SERVICE = 'worker_service',
  GATEWAY_SERVICE = 'gateway_service',
  DATABASE_SERVICE = 'database_service',
}
