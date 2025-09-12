import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger';

interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface RequestOptions extends AxiosRequestConfig {
  retries?: number;
  requestId?: string;
}

class HttpClient {
  private client: AxiosInstance;
  private maxRetries: number;
  private retryDelay: number;

  constructor(config: HttpClientConfig) {
    this.maxRetries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ecommerce-microservice/1.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      config => {
        const requestId = config.headers?.['X-Request-Id'] as string;
        logger.debug('HTTP request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          requestId,
        });
        return config;
      },
      error => {
        logger.error('HTTP request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      response => {
        const requestId = response.config.headers?.['X-Request-Id'] as string;
        logger.debug('HTTP response', {
          status: response.status,
          url: response.config.url,
          requestId,
        });
        return response;
      },
      error => {
        const requestId = error.config?.headers?.['X-Request-Id'] as string;
        logger.error('HTTP response error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          requestId,
        });
        return Promise.reject(error);
      }
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>,
    retries: number,
    requestId?: string
  ): Promise<AxiosResponse<T>> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === retries) {
          logger.error('HTTP request failed after all retries', {
            attempts: attempt + 1,
            error: lastError.message,
            requestId,
          });
          break;
        }

        if (
          axios.isAxiosError(error) &&
          (error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            (error.response?.status && error.response.status >= 500))
        ) {
          const delayMs = this.retryDelay * Math.pow(2, attempt);
          logger.warn('HTTP request failed, retrying...', {
            attempt: attempt + 1,
            maxRetries: retries + 1,
            delayMs,
            error: error.message,
            requestId,
          });
          await this.delay(delayMs);
        } else {
          break;
        }
      }
    }

    throw lastError!;
  }

  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { retries = this.maxRetries, requestId, ...config } = options;

    if (requestId) {
      config.headers = { ...config.headers, 'X-Request-Id': requestId };
    }

    const response = await this.executeWithRetry(
      () => this.client.get<T>(url, config),
      retries,
      requestId
    );
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const { retries = this.maxRetries, requestId, ...config } = options;

    if (requestId) {
      config.headers = { ...config.headers, 'X-Request-Id': requestId };
    }

    const response = await this.executeWithRetry(
      () => this.client.post<T>(url, data, config),
      retries,
      requestId
    );
    return response.data;
  }

  async put<T>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const { retries = this.maxRetries, requestId, ...config } = options;

    if (requestId) {
      config.headers = { ...config.headers, 'X-Request-Id': requestId };
    }

    const response = await this.executeWithRetry(
      () => this.client.put<T>(url, data, config),
      retries,
      requestId
    );
    return response.data;
  }

  async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { retries = this.maxRetries, requestId, ...config } = options;

    if (requestId) {
      config.headers = { ...config.headers, 'X-Request-Id': requestId };
    }

    const response = await this.executeWithRetry(
      () => this.client.delete<T>(url, config),
      retries,
      requestId
    );
    return response.data;
  }
}

export { HttpClient, type HttpClientConfig, type RequestOptions };

