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

  private readonly unlockScript = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else
      return 0
    end
  `;

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
      const ttlMs = options.ttlMs || 30000;
      if (ttlMs > 10000) {
        const extensionInterval = Math.floor(ttlMs / 3);
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
      if (lockExtendInterval) {
        clearInterval(lockExtendInterval);
      }

      await this.releaseLock(key, lockValue, requestId);
    }
  }


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


  async cleanupExpiredLocks(): Promise<number> {
    try {
      const pattern = this.getLockKey('*');
      const keys = await this.redisClient.getClient().keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const pipeline = this.redisClient.getClient().pipeline();

      for (const key of keys) {
        pipeline.pttl(key);
      }

      const ttls = await pipeline.exec();
      const expiredKeys: string[] = [];

      ttls?.forEach((result, index) => {
        const [error, ttl] = result;
        if (!error && (ttl === -2 || ttl === 0) && keys[index]) {
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


  private getLockKey(key: string): string {
    return `${this.lockPrefix}${key}`;
  }


  private generateLockValue(): string {
    return `${this.nodeId}-${uuidv4()}`;
  }


  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


