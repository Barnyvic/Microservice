import Redis from 'ioredis';
import { logger } from './logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

export class RedisClient {
  private client: Redis;
  private isConnected = false;
  private readonly keyPrefix: string;

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix || 'microservice:';

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: config.lazyConnect || true,
      family: 4,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis retry attempt', { times, delay });
        return delay;
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready');
    });

    this.client.on('error', (error: Error) => {
      this.isConnected = false;
      logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis client connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  getClient(): Redis {
    return this.client;
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async set(
    key: string,
    value: string | number | object,
    ttlSeconds?: number
  ): Promise<void> {
    try {
      const prefixedKey = this.getKey(key);
      const stringValue =
        typeof value === 'object' ? JSON.stringify(value) : String(value);

      if (ttlSeconds) {
        await this.client.setex(prefixedKey, ttlSeconds, stringValue);
      } else {
        await this.client.set(prefixedKey, stringValue);
      }
    } catch (error) {
      logger.error('Redis SET error:', { error, key });
      throw error;
    }
  }

  async get<T = string>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.getKey(key);
      const value = await this.client.get(prefixedKey);

      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      logger.error('Redis GET error:', { error, key });
      throw error;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const result = await this.client.del(prefixedKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error:', { error, key });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const result = await this.client.exists(prefixedKey);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { error, key });
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const result = await this.client.expire(prefixedKey, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error:', { error, key });
      throw error;
    }
  }
}
