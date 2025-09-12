import { RedisClient } from './redis-client';
import { logger } from './logger';

export interface CacheOptions {
  ttlSeconds?: number;
  prefix?: string;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
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
    defaultTtlSeconds = 300, // 5 minutes default
    keyPrefix = 'cache:'
  ) {
    this.redisClient = redisClient;
    this.defaultTtl = defaultTtlSeconds;
    this.keyPrefix = keyPrefix;
  }

  /**
   * Get cached value or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cacheKey = this.getCacheKey(key, options.prefix);

    try {
      // Try to get from cache first
      const cached = await this.get<T>(cacheKey);

      if (cached !== null) {
        this.stats.hits++;
        logger.debug('Cache hit', { key: cacheKey });
        return cached;
      }

      // Cache miss - fetch fresh data
      this.stats.misses++;
      logger.debug('Cache miss, fetching fresh data', { key: cacheKey });

      const freshData = await fetchFn();

      // Cache the result
      await this.set(cacheKey, freshData, options);

      return freshData;
    } catch (error) {
      logger.error('Cache getOrSet error', { error, key: cacheKey });
      // If cache fails, still return fresh data
      return await fetchFn();
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
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
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Get value from cache
   */
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

  /**
   * Delete value from cache
   */
  async del(key: string, prefix?: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(key, prefix);

    try {
      const result = await this.redisClient.del(cacheKey);
      logger.debug('Cache delete', { key: cacheKey, result });
      return result;
    } catch (error) {
      logger.error('Cache delete error', { error, key: cacheKey });
      return false;
    }
  }

  /**
   * Invalidate cache by pattern
   */
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

  /**
   * Cache multiple values at once
   */
  async mset(
    keyValues: Record<string, any>,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttlSeconds || this.defaultTtl;
    const pipeline = this.redisClient.getClient().pipeline();

    try {
      for (const [key, value] of Object.entries(keyValues)) {
        const cacheKey = this.getCacheKey(key, options.prefix);
        const stringValue =
          typeof value === 'object' ? JSON.stringify(value) : String(value);
        pipeline.setex(cacheKey, ttl, stringValue);
      }

      await pipeline.exec();
      logger.debug('Cache mset completed', {
        keyCount: Object.keys(keyValues).length,
        ttl,
      });
    } catch (error) {
      logger.error('Cache mset error', { error });
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[], prefix?: string): Promise<(T | null)[]> {
    const cacheKeys = keys.map(key => this.getCacheKey(key, prefix));

    try {
      return await this.redisClient.mget<T>(cacheKeys);
    } catch (error) {
      logger.error('Cache mget error', { error, keys: cacheKeys });
      return keys.map(() => null);
    }
  }

  /**
   * Increment a counter in cache
   */
  async increment(
    key: string,
    amount = 1,
    options: CacheOptions = {}
  ): Promise<number> {
    const cacheKey = this.getCacheKey(key, options.prefix);

    try {
      const result = await this.redisClient.incrBy(cacheKey, amount);

      // Set TTL if it's a new key
      const ttl = options.ttlSeconds || this.defaultTtl;
      await this.redisClient.expire(cacheKey, ttl);

      return result;
    } catch (error) {
      logger.error('Cache increment error', { error, key: cacheKey });
      return 0;
    }
  }

  /**
   * Add to set in cache
   */
  async sadd(
    key: string,
    members: string[],
    options: CacheOptions = {}
  ): Promise<number> {
    const cacheKey = this.getCacheKey(key, options.prefix);

    try {
      const result = await this.redisClient.sadd(cacheKey, ...members);

      // Set TTL
      const ttl = options.ttlSeconds || this.defaultTtl;
      await this.redisClient.expire(cacheKey, ttl);

      return result;
    } catch (error) {
      logger.error('Cache sadd error', { error, key: cacheKey });
      return 0;
    }
  }

  /**
   * Get set members from cache
   */
  async smembers(key: string, prefix?: string): Promise<string[]> {
    const cacheKey = this.getCacheKey(key, prefix);

    try {
      return await this.redisClient.smembers(cacheKey);
    } catch (error) {
      logger.error('Cache smembers error', { error, key: cacheKey });
      return [];
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(
    key: string,
    member: string,
    prefix?: string
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(key, prefix);

    try {
      return await this.redisClient.sismember(cacheKey, member);
    } catch (error) {
      logger.error('Cache sismember error', { error, key: cacheKey });
      return false;
    }
  }

  /**
   * Cache with tags for group invalidation
   */
  async setWithTags<T>(
    key: string,
    value: T,
    tags: string[],
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.getCacheKey(key, options.prefix);
    const ttl = options.ttlSeconds || this.defaultTtl;

    try {
      // Set the main cache entry
      await this.redisClient.set(cacheKey, value, ttl);

      // Add key to each tag set
      const pipeline = this.redisClient.getClient().pipeline();

      for (const tag of tags) {
        const tagKey = this.getCacheKey(`tag:${tag}`, options.prefix);
        pipeline.sadd(tagKey, cacheKey);
        pipeline.expire(tagKey, ttl);
      }

      await pipeline.exec();

      logger.debug('Cache set with tags', {
        key: cacheKey,
        tags,
        ttl,
      });
    } catch (error) {
      logger.error('Cache setWithTags error', { error, key: cacheKey, tags });
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string, prefix?: string): Promise<number> {
    const tagKey = this.getCacheKey(`tag:${tag}`, prefix);

    try {
      // Get all keys with this tag
      const keys = await this.redisClient.smembers(tagKey);

      if (keys.length === 0) {
        return 0;
      }

      // Delete all tagged keys and the tag itself
      const result = await this.redisClient.getClient().del(...keys, tagKey);

      logger.info('Cache invalidated by tag', {
        tag,
        keysDeleted: result - 1, // Subtract 1 for the tag key itself
      });

      return result - 1;
    } catch (error) {
      logger.error('Cache invalidateByTag error', { error, tag });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalRequests,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Check cache health
   */
  async isHealthy(): Promise<boolean> {
    try {
      const testKey = this.getCacheKey('health-check');
      await this.redisClient.set(testKey, 'ok', 60);
      const result = await this.redisClient.get(testKey);
      await this.redisClient.del(testKey);
      return result === 'ok';
    } catch (error) {
      logger.error('Cache health check failed', { error });
      return false;
    }
  }

  /**
   * Generate cache key with prefix
   */
  private getCacheKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.keyPrefix;
    return `${finalPrefix}${key}`;
  }
}

