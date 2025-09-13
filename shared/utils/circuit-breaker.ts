import { logger } from './logger';
import { CircuitState } from '../enums';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringPeriod: number;
  expectedErrors?: string[];
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
      timeout: 60000,
      monitoringPeriod: 300000,
      expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
      ...options,
    };

    logger.info('Circuit breaker initialized', {
      name: this.name,
      options: this.options,
    });
  }

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

      if (fallback) {
        logger.info('Circuit breaker using fallback', {
          name: this.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return fallback();
      }

      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failureCount = 0;

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

  private onFailure(error: unknown): void {
    this.lastFailureTime = Date.now();

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

    if (this.state === CircuitState.HALF_OPEN) {
      this.trip();
    }
  }

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

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = undefined;
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt !== undefined && Date.now() >= this.nextAttempt;
  }

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

  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  forceReset(): void {
    logger.info('Circuit breaker force reset', { name: this.name });
    this.reset();
  }

  forceTrip(): void {
    logger.info('Circuit breaker force trip', { name: this.name });
    this.trip();
  }
}


