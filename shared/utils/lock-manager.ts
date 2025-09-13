import mongoose from 'mongoose';
import { logger } from './logger';

export interface DistributedLock {
  key: string;
  owner: string;
  expiresAt: Date;
  createdAt: Date;
}

const lockSchema = new mongoose.Schema<DistributedLock>({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  owner: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Lock = mongoose.model<DistributedLock>('DistributedLock', lockSchema);

export class LockManager {
  private readonly defaultTtl = 30000;
  private readonly nodeId: string;

  constructor() {
    this.nodeId = `${process.env.SERVICE_NAME || 'unknown'}-${
      process.pid
    }-${Date.now()}`;
  }

  async acquireLock(
    key: string,
    ttlMs: number = this.defaultTtl,
    requestId?: string
  ): Promise<boolean> {
    try {
      const lockKey = `lock:${key}`;
      const expiresAt = new Date(Date.now() + ttlMs);

      logger.debug('Attempting to acquire lock', {
        key: lockKey,
        owner: this.nodeId,
        ttlMs,
        requestId,
      });

      try {
        await Lock.create({
          key: lockKey,
          owner: this.nodeId,
          expiresAt,
          createdAt: new Date(),
        });

        logger.info('Lock acquired successfully', {
          key: lockKey,
          owner: this.nodeId,
          expiresAt,
          requestId,
        });

        return true;
      } catch (error: any) {
        if (error.code === 11000) {
          logger.debug('Lock already exists', {
            key: lockKey,
            requestId,
          });

          await this.cleanupExpiredLocks();
          return false;
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to acquire lock', {
        error,
        key,
        requestId,
      });
      return false;
    }
  }

  async releaseLock(key: string, requestId?: string): Promise<boolean> {
    try {
      const lockKey = `lock:${key}`;

      logger.debug('Attempting to release lock', {
        key: lockKey,
        owner: this.nodeId,
        requestId,
      });

      const result = await Lock.deleteOne({
        key: lockKey,
        owner: this.nodeId,
      });

      const released = result.deletedCount > 0;

      if (released) {
        logger.info('Lock released successfully', {
          key: lockKey,
          owner: this.nodeId,
          requestId,
        });
      } else {
        logger.warn('Failed to release lock - not owner or lock not found', {
          key: lockKey,
          owner: this.nodeId,
          requestId,
        });
      }

      return released;
    } catch (error) {
      logger.error('Failed to release lock', {
        error,
        key,
        requestId,
      });
      return false;
    }
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = this.defaultTtl,
    requestId?: string
  ): Promise<T> {
    const lockAcquired = await this.acquireLock(key, ttlMs, requestId);

    if (!lockAcquired) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    try {
      logger.debug('Executing function with lock', {
        key,
        requestId,
      });

      const result = await fn();

      logger.debug('Function executed successfully with lock', {
        key,
        requestId,
      });

      return result;
    } finally {
      await this.releaseLock(key, requestId);
    }
  }

  private async cleanupExpiredLocks(): Promise<void> {
    try {
      const result = await Lock.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      if (result.deletedCount > 0) {
        logger.info('Cleaned up expired locks', {
          count: result.deletedCount,
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired locks', { error });
    }
  }

  startCleanupJob(intervalMs: number = 60000): NodeJS.Timeout {
    logger.info('Starting lock cleanup job', { intervalMs });

    return setInterval(() => {
      this.cleanupExpiredLocks();
    }, intervalMs);
  }

  async isLocked(key: string): Promise<boolean> {
    try {
      const lockKey = `lock:${key}`;
      const lock = await Lock.findOne({
        key: lockKey,
        expiresAt: { $gt: new Date() },
      });

      return lock !== null;
    } catch (error) {
      logger.error('Failed to check lock status', { error, key });
      return false;
    }
  }
}


