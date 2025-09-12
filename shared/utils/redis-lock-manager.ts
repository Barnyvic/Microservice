import { RedisClient } from './redis-client';
import { logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

export interface RedisLockOptions {
  ttlMs?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

export class RedisLockManager {
  private readonly redisClient: RedisClient;
  private readonly nodeId: string;
  private readonly lockPrefix = 'lock:';

  // Lua script for atomic lock release (ensures only lock owner can release)
  private readonly unlockScript = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else
      return 0
    end
  `;

  // Lua script for atomic lock extension
  private readonly extendScript = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('PEXPIRE', KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
    this.nodeId = `${process.env.SERVICE_NAME || 'unknown'}-${
      process.pid
    }-${Date.now()}`;
  }

  /**
   * Acquire a distributed lock with automatic retry
   */
  async acquireLock(
    key: string,
    options: RedisLockOptions = {},
    requestId?: string
  ): Promise<string | null> {
    const { ttlMs = 30000, retryDelayMs = 100, maxRetries = 50 } = options;

    const lockKey = this.getLockKey(key);
    const lockValue = this.generateLockValue();
    let attempts = 0;

    logger.debug('Attempting to acquire Redis lock', {
      key: lockKey,
      ttlMs,
      maxRetries,
      requestId,
    });

    while (attempts <= maxRetries) {
      try {
        // Try to set lock with NX (only if not exists) and PX (expiration in ms)
        const result = await this.redisClient
          .getClient()
          .set(lockKey, lockValue, 'PX', ttlMs, 'NX');

        if (result === 'OK') {
          logger.info('Redis lock acquired successfully', {
            key: lockKey,
            lockValue,
            ttlMs,
            attempts,
            requestId,
          });
          return lockValue;
        }

        attempts++;
        if (attempts <= maxRetries) {
          // Wait before retrying with exponential backoff
          const delay = Math.min(
            retryDelayMs * Math.pow(2, attempts - 1),
            5000
          );
          await this.sleep(delay);
        }
      } catch (error) {
        logger.error('Error acquiring Redis lock', {
          error,
          key: lockKey,
          attempts,
          requestId,
        });
        throw error;
      }
    }

    logger.warn('Failed to acquire Redis lock after max retries', {
      key: lockKey,
      maxRetries,
      requestId,
    });

    return null;
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(
    key: string,
    lockValue: string,
    requestId?: string
  ): Promise<boolean> {
    const lockKey = this.getLockKey(key);

    try {
      logger.debug('Attempting to release Redis lock', {
        key: lockKey,
        lockValue,
        requestId,
      });

      // Use Lua script to atomically check and delete the lock
      const result = (await this.redisClient
        .getClient()
        .eval(this.unlockScript, 1, lockKey, lockValue)) as number;

      const released = result === 1;

      if (released) {
        logger.info('Redis lock released successfully', {
          key: lockKey,
          lockValue,
          requestId,
        });
      } else {
        logger.warn(
          'Failed to release Redis lock - not owner or lock expired',
          {
            key: lockKey,
            lockValue,
            requestId,
          }
        );
      }

      return released;
    } catch (error) {
      logger.error('Error releasing Redis lock', {
        error,
        key: lockKey,
        lockValue,
        requestId,
      });
      return false;
    }
  }

  /**
   * Extend lock expiration
   */
  async extendLock(
    key: string,
    lockValue: string,
    ttlMs: number,
    requestId?: string
  ): Promise<boolean> {
    const lockKey = this.getLockKey(key);

    try {
      const result = (await this.redisClient
        .getClient()
        .eval(this.extendScript, 1, lockKey, lockValue, ttlMs)) as number;

      const extended = result === 1;

      if (extended) {
        logger.debug('Redis lock extended successfully', {
          key: lockKey,
          lockValue,
          ttlMs,
          requestId,
        });
      }

      return extended;
    } catch (error) {
      logger.error('Error extending Redis lock', {
        error,
        key: lockKey,
        lockValue,
        requestId,
      });
      return false;
    }
  }

  /**
   * Execute a function with distributed lock protection
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: RedisLockOptions = {},
    requestId?: string
  ): Promise<T> {
    const lockValue = await this.acquireLock(key, options, requestId);

    if (!lockValue) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    let lockExtendInterval: NodeJS.Timeout | undefined;

    try {
      // Set up lock extension if TTL is long enough
      const ttlMs = options.ttlMs || 30000;
      if (ttlMs > 10000) {
        const extensionInterval = Math.floor(ttlMs / 3); // Extend at 1/3 of TTL
        lockExtendInterval = setInterval(() => {
          this.extendLock(key, lockValue, ttlMs, requestId).catch(error => {
            logger.error('Failed to extend lock in background', {
              error,
              key,
              requestId,
            });
          });
        }, extensionInterval);
      }

      logger.debug('Executing function with Redis lock', {
        key,
        lockValue,
        requestId,
      });

      const result = await fn();

      logger.debug('Function executed successfully with Redis lock', {
        key,
        lockValue,
        requestId,
      });

      return result;
    } finally {
      // Clear extension interval
      if (lockExtendInterval) {
        clearInterval(lockExtendInterval);
      }

      // Release the lock
      await this.releaseLock(key, lockValue, requestId);
    }
  }

  /**
   * Check if a lock exists
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.getLockKey(key);

    try {
      const exists = await this.redisClient.exists(lockKey);
      return exists;
    } catch (error) {
      logger.error('Error checking lock status', { error, key });
      return false;
    }
  }

  /**
   * Get lock info
   */
  async getLockInfo(key: string): Promise<{
    locked: boolean;
    owner?: string;
    ttl?: number;
  }> {
    const lockKey = this.getLockKey(key);

    try {
      const [owner, ttl] = await Promise.all([
        this.redisClient.get<string>(lockKey),
        this.redisClient.getClient().pttl(lockKey),
      ]);

      return {
        locked: owner !== null,
        owner: owner || undefined,
        ttl: ttl > 0 ? ttl : undefined,
      };
    } catch (error) {
      logger.error('Error getting lock info', { error, key });
      return { locked: false };
    }
  }

  /**
   * Force release any lock (admin operation)
   */
  async forceReleaseLock(key: string, requestId?: string): Promise<boolean> {
    const lockKey = this.getLockKey(key);

    try {
      const result = await this.redisClient.del(lockKey);

      if (result) {
        logger.warn('Lock force released', {
          key: lockKey,
          requestId,
        });
      }

      return result;
    } catch (error) {
      logger.error('Error force releasing lock', { error, key, requestId });
      return false;
    }
  }

  /**
   * Clean up expired locks (maintenance operation)
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const pattern = this.getLockKey('*');
      const keys = await this.redisClient.getClient().keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      // Check TTL for each key and remove expired ones
      const pipeline = this.redisClient.getClient().pipeline();

      for (const key of keys) {
        pipeline.pttl(key);
      }

      const ttls = await pipeline.exec();
      const expiredKeys: string[] = [];

      ttls?.forEach((result, index) => {
        const [error, ttl] = result;
        if (!error && (ttl === -2 || ttl === 0)) {
          // -2 means key doesn't exist, 0 means expired
          expiredKeys.push(keys[index]);
        }
      });

      if (expiredKeys.length > 0) {
        await this.redisClient.getClient().del(...expiredKeys);
        logger.info('Cleaned up expired locks', {
          count: expiredKeys.length,
          keys: expiredKeys,
        });
      }

      return expiredKeys.length;
    } catch (error) {
      logger.error('Error cleaning up expired locks', { error });
      return 0;
    }
  }

  /**
   * Generate lock key with prefix
   */
  private getLockKey(key: string): string {
    return `${this.lockPrefix}${key}`;
  }

  /**
   * Generate unique lock value
   */
  private generateLockValue(): string {
    return `${this.nodeId}-${uuidv4()}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
