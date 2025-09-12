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
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: config.lazyConnect || true,
      // Connection pool settings
      family: 4,
      keepAlive: true,
      // Retry strategy
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis retry attempt', { times, delay });
        return delay;
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
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

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis client connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
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

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }

  /**
   * Get Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Generate a prefixed key
   */
  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Set a value with optional TTL
   */
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

  /**
   * Get a value
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.getKey(key);
      const value = await this.client.get(prefixedKey);

      if (value === null) {
        return null;
      }

      // Try to parse as JSON, fall back to string
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

  /**
   * Delete a key
   */
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

  /**
   * Check if key exists
   */
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

  /**
   * Set expiration on a key
   */
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

  /**
   * Increment a value atomically
   */
  async incr(key: string): Promise<number> {
    try {
      const prefixedKey = this.getKey(key);
      return await this.client.incr(prefixedKey);
    } catch (error) {
      logger.error('Redis INCR error:', { error, key });
      throw error;
    }
  }

  /**
   * Increment a value by amount atomically
   */
  async incrBy(key: string, amount: number): Promise<number> {
    try {
      const prefixedKey = this.getKey(key);
      return await this.client.incrby(prefixedKey, amount);
    } catch (error) {
      logger.error('Redis INCRBY error:', { error, key });
      throw error;
    }
  }

  /**
   * Set multiple keys atomically
   */
  async mset(
    keyValues: Record<string, string | number | object>
  ): Promise<void> {
    try {
      const pipeline = this.client.pipeline();

      for (const [key, value] of Object.entries(keyValues)) {
        const prefixedKey = this.getKey(key);
        const stringValue =
          typeof value === 'object' ? JSON.stringify(value) : String(value);
        pipeline.set(prefixedKey, stringValue);
      }

      await pipeline.exec();
    } catch (error) {
      logger.error('Redis MSET error:', { error });
      throw error;
    }
  }

  /**
   * Get multiple keys
   */
  async mget<T = string>(keys: string[]): Promise<(T | null)[]> {
    try {
      const prefixedKeys = keys.map(key => this.getKey(key));
      const values = await this.client.mget(...prefixedKeys);

      return values.map(value => {
        if (value === null) {
          return null;
        }

        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      logger.error('Redis MGET error:', { error, keys });
      throw error;
    }
  }

  /**
   * Add items to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      const prefixedKey = this.getKey(key);
      return await this.client.sadd(prefixedKey, ...members);
    } catch (error) {
      logger.error('Redis SADD error:', { error, key });
      throw error;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      const prefixedKey = this.getKey(key);
      return await this.client.smembers(prefixedKey);
    } catch (error) {
      logger.error('Redis SMEMBERS error:', { error, key });
      throw error;
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const prefixedKey = this.getKey(key);
      const result = await this.client.sismember(prefixedKey, member);
      return result === 1;
    } catch (error) {
      logger.error('Redis SISMEMBER error:', { error, key });
      throw error;
    }
  }

  /**
   * Execute Redis pipeline for batch operations
   */
  async pipeline(
    commands: Array<{ command: string; args: any[] }>
  ): Promise<any[]> {
    try {
      const pipeline = this.client.pipeline();

      for (const { command, args } of commands) {
        (pipeline as any)[command](...args);
      }

      const results = await pipeline.exec();
      return (
        results?.map(([error, result]) => {
          if (error) throw error;
          return result;
        }) || []
      );
    } catch (error) {
      logger.error('Redis PIPELINE error:', { error });
      throw error;
    }
  }

  /**
   * Get Redis info for health checks
   */
  async getInfo(): Promise<{
    connected: boolean;
    memoryUsed: string;
    connectedClients: number;
    uptime: number;
  }> {
    try {
      const info = await this.client.info();
      const lines = info.split('\r\n');

      const memoryLine = lines.find(line =>
        line.startsWith('used_memory_human:')
      );
      const clientsLine = lines.find(line =>
        line.startsWith('connected_clients:')
      );
      const uptimeLine = lines.find(line =>
        line.startsWith('uptime_in_seconds:')
      );

      return {
        connected: this.isHealthy(),
        memoryUsed: memoryLine?.split(':')[1] || 'unknown',
        connectedClients: parseInt(clientsLine?.split(':')[1] || '0'),
        uptime: parseInt(uptimeLine?.split(':')[1] || '0'),
      };
    } catch (error) {
      logger.error('Redis INFO error:', { error });
      return {
        connected: false,
        memoryUsed: 'unknown',
        connectedClients: 0,
        uptime: 0,
      };
    }
  }
}
