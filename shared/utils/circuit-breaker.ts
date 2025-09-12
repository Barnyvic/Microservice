import { logger } from './logger';
import { CircuitState } from '../enums';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures to open circuit
  successThreshold: number; // Number of successes to close circuit (from half-open)
  timeout: number; // Milliseconds to wait before trying half-open
  monitoringPeriod: number; // Sliding window in milliseconds
  expectedErrors?: string[]; // Error types that should trip the circuit
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttempt?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttempt?: number;
  private readonly options: CircuitBreakerOptions;
  private readonly name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
      ...options,
    };

    logger.info('Circuit breaker initialized', {
      name: this.name,
      options: this.options,
    });
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          name: this.name,
        });
      } else {
        logger.warn('Circuit breaker is OPEN, failing fast', {
          name: this.name,
          nextAttempt: this.nextAttempt,
        });

        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      if (fallback && this.state === CircuitState.OPEN) {
        logger.info('Circuit breaker using fallback', {
          name: this.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failureCount = 0; // Reset failure count on success

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.reset();
        logger.info('Circuit breaker CLOSED after successful reset', {
          name: this.name,
          successCount: this.successCount,
        });
      }
    }
  }

  /**
   * Record a failed operation
   */
  private onFailure(error: unknown): void {
    this.lastFailureTime = Date.now();

    // Only count certain types of errors
    if (this.shouldCountError(error)) {
      this.failureCount++;

      logger.warn('Circuit breaker recorded failure', {
        name: this.name,
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (this.failureCount >= this.options.failureThreshold) {
        this.trip();
      }
    }

    // If we're in half-open state and get a failure, go back to open
    if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
    }
  }

  /**
   * Determine if an error should count towards circuit breaker
   */
  private shouldCountError(error: unknown): boolean {
    if (!error || !this.options.expectedErrors) {
      return true;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;

    return this.options.expectedErrors.some(
      expectedError =>
        errorMessage.includes(expectedError) || errorCode === expectedError
    );
  }

  /**
   * Trip the circuit breaker to OPEN state
   */
  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.options.timeout;
    this.successCount = 0;

    logger.warn('Circuit breaker OPENED', {
      name: this.name,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
    });
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
  }

  /**
   * Check if we should attempt to reset from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttempt !== undefined && Date.now() >= this.nextAttempt;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt,
    };
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Force reset the circuit breaker (for testing/admin purposes)
   */
  forceReset(): void {
    logger.info('Circuit breaker force reset', { name: this.name });
    this.reset();
  }

  /**
   * Force trip the circuit breaker (for testing/admin purposes)
   */
  forceTrip(): void {
    logger.info('Circuit breaker force trip', { name: this.name });
    this.trip();
  }
}
