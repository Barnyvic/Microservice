import { RedisClient } from './redis-client';
import { logger } from './logger';

export interface CacheOptions {
  ttlSeconds?: number;
  prefix?: string;
  compress?: boolean;
}

export class CacheManager {
  private readonly redisClient: RedisClient;
  private readonly defaultTtl: number;
  private readonly keyPrefix: string;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(
    redisClient: RedisClient,
    defaultTtlSeconds = 300,
    keyPrefix = 'cache:'
  ) {
    this.redisClient = redisClient;
    this.defaultTtl = defaultTtlSeconds;
    this.keyPrefix = keyPrefix;
  }

  async getOrSet<T extends string | number | object>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cacheKey = this.getCacheKey(key, options.prefix);

    try {
      const cached = await this.get<T>(cacheKey);

      if (cached !== null) {
        this.stats.hits++;
        logger.debug('Cache hit', { key: cacheKey });
        return cached;
      }

      this.stats.misses++;
      logger.debug('Cache miss, fetching fresh data', { key: cacheKey });

      const freshData = await fetchFn();

      await this.set(cacheKey, freshData, options);

      return freshData;
    } catch (error) {
      logger.error('Cache getOrSet error', { error, key: cacheKey });

      return await fetchFn();
    }
  }

  async set<T extends string | number | object>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.getCacheKey(key, options.prefix);
    const ttl = options.ttlSeconds || this.defaultTtl;

    try {
      await this.redisClient.set(cacheKey, value, ttl);
      logger.debug('Cache set', { key: cacheKey, ttl });
    } catch (error) {
      logger.error('Cache set error', { error, key: cacheKey });
    }
  }

  async get<T>(key: string, prefix?: string): Promise<T | null> {
    const cacheKey = this.getCacheKey(key, prefix);

    try {
      const value = await this.redisClient.get<T>(cacheKey);
      return value;
    } catch (error) {
      logger.error('Cache get error', { error, key: cacheKey });
      return null;
    }
  }

  async invalidatePattern(pattern: string, prefix?: string): Promise<number> {
    const searchPattern = this.getCacheKey(pattern, prefix);

    try {
      const keys = await this.redisClient.getClient().keys(searchPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redisClient.getClient().del(...keys);
      logger.info('Cache pattern invalidated', {
        pattern: searchPattern,
        keysDeleted: result,
      });

      return result;
    } catch (error) {
      logger.error('Cache pattern invalidation error', {
        error,
        pattern: searchPattern,
      });
      return 0;
    }
  }

  private getCacheKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.keyPrefix;
    return `${finalPrefix}${key}`;
  }
}
