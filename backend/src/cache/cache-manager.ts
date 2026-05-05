import NodeCache from 'node-cache';
import { FileCacheStorage } from './cache-storage';
import { CacheStatsTracker, type DetailedCacheStats } from './cache-stats';
import { logger } from '../utils/logger';

/**
 * Cache configuration options
 */
export interface CacheConfig {
  readonly l1Enabled: boolean;
  readonly l1TtlSeconds: number;
  readonly l1MaxKeys: number;
  readonly l2Enabled: boolean;
  readonly l2CacheDir: string;
  readonly cleanupIntervalMs: number;
}

/**
 * Default cache TTLs (in milliseconds)
 */
export const CacheTTL = {
  RESOURCES: 60 * 60 * 1000, // 1 hour
  USAGE: 24 * 60 * 60 * 1000, // 24 hours
  CORRELATION: 30 * 60 * 1000, // 30 minutes
  REPORT: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Multi-layer cache manager with L1 (memory) and L2 (file) caching
 */
export class CacheManager {
  private readonly l1Cache: NodeCache;
  private readonly l2Cache: FileCacheStorage;
  private readonly stats: CacheStatsTracker;
  private readonly config: CacheConfig;
  private readonly inFlightRequests: Map<string, Promise<unknown>>;
  private cleanupInterval?: NodeJS.Timeout;

  public constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      l1Enabled: config.l1Enabled ?? true,
      l1TtlSeconds: config.l1TtlSeconds ?? 3600,
      l1MaxKeys: config.l1MaxKeys ?? 1000,
      l2Enabled: config.l2Enabled ?? true,
      l2CacheDir: config.l2CacheDir ?? '.cache',
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60 * 60 * 1000, // 1 hour
    };

    // Initialize L1 cache (memory)
    this.l1Cache = new NodeCache({
      stdTTL: this.config.l1TtlSeconds,
      maxKeys: this.config.l1MaxKeys,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Don't clone objects for better performance
    });

    // Initialize L2 cache (file)
    this.l2Cache = new FileCacheStorage(this.config.l2CacheDir);

    // Initialize statistics tracker
    this.stats = new CacheStatsTracker();

    // Initialize in-flight request tracking
    this.inFlightRequests = new Map();

    logger.info('Cache manager initialized', { config: this.config });
  }

  /**
   * Initializes the cache manager
   */
  public async initialize(): Promise<void> {
    if (this.config.l2Enabled) {
      await this.l2Cache.initialize();
    }

    // Start cleanup interval
    this.startCleanupInterval();

    logger.info('Cache manager ready');
  }

  /**
   * Gets a value from the cache with multi-layer fallback
   * @param key - Cache key
   * @returns Cached value or null
   */
  public async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try L1 cache first
      if (this.config.l1Enabled) {
        const l1Value = this.l1Cache.get<T>(key);
        if (l1Value !== undefined) {
          this.stats.recordHit(1);
          this.stats.recordGetTime(Date.now() - startTime);
          logger.debug('Cache hit (L1)', { key });
          return l1Value;
        }
        this.stats.recordMiss(1);
      }

      // Try L2 cache
      if (this.config.l2Enabled) {
        const l2Value = await this.l2Cache.get<T>(key);
        if (l2Value !== null) {
          this.stats.recordHit(2);
          // Promote to L1
          if (this.config.l1Enabled) {
            this.l1Cache.set(key, l2Value);
          }
          this.stats.recordGetTime(Date.now() - startTime);
          logger.debug('Cache hit (L2)', { key });
          return l2Value;
        }
        this.stats.recordMiss(2);
      }

      this.stats.recordGetTime(Date.now() - startTime);
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Sets a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  public async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();

    try {
      const effectiveTtl = ttl ?? CacheTTL.RESOURCES;

      // Set in L1 cache
      if (this.config.l1Enabled) {
        const ttlSeconds = Math.floor(effectiveTtl / 1000);
        this.l1Cache.set(key, value, ttlSeconds);
        this.stats.recordSet(1);
      }

      // Set in L2 cache
      if (this.config.l2Enabled) {
        await this.l2Cache.set(key, value, effectiveTtl);
        this.stats.recordSet(2);
      }

      this.stats.recordSetTime(Date.now() - startTime);
      logger.debug('Cache set', { key, ttl: effectiveTtl });
    } catch (error) {
      logger.error('Cache set error', { key, error });
      throw error;
    }
  }

  /**
   * Deletes a value from the cache
   * @param key - Cache key
   */
  public async delete(key: string): Promise<void> {
    try {
      // Delete from L1
      if (this.config.l1Enabled) {
        this.l1Cache.del(key);
        this.stats.recordDelete(1);
      }

      // Delete from L2
      if (this.config.l2Enabled) {
        await this.l2Cache.delete(key);
        this.stats.recordDelete(2);
      }

      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      throw error;
    }
  }

  /**
   * Clears all cache entries
   */
  public async clear(): Promise<void> {
    try {
      // Clear L1
      if (this.config.l1Enabled) {
        this.l1Cache.flushAll();
      }

      // Clear L2
      if (this.config.l2Enabled) {
        await this.l2Cache.clear();
      }

      // Clear in-flight requests
      this.inFlightRequests.clear();

      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error', { error });
      throw error;
    }
  }

  /**
   * Clears cache entries matching a pattern
   * @param pattern - Pattern to match (e.g., "resources:*")
   */
  public async clearPattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    try {
      // Clear from L1
      if (this.config.l1Enabled) {
        const keys = this.l1Cache.keys();
        for (const key of keys) {
          if (this.matchesPattern(key, pattern)) {
            this.l1Cache.del(key);
            deletedCount++;
          }
        }
      }

      // Clear from L2
      if (this.config.l2Enabled) {
        const l2Deleted = await this.l2Cache.clearPattern(pattern);
        deletedCount += l2Deleted;
      }

      logger.info('Cleared cache by pattern', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cache clear pattern error', { pattern, error });
      throw error;
    }
  }

  /**
   * Gets or sets a value with request deduplication
   * @param key - Cache key
   * @param factory - Function to generate value if not cached
   * @param ttl - Time to live in milliseconds
   * @returns Cached or generated value
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if request is already in flight
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      logger.debug('Request deduplication', { key });
      return inFlight as Promise<T>;
    }

    // Execute factory and cache result
    const promise = factory()
      .then(async (value) => {
        await this.set(key, value, ttl);
        this.inFlightRequests.delete(key);
        return value;
      })
      .catch((error) => {
        this.inFlightRequests.delete(key);
        throw error;
      });

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  /**
   * Gets cache statistics
   * @returns Detailed cache statistics
   */
  public async getStats(): Promise<DetailedCacheStats> {
    const l1Size = this.config.l1Enabled ? this.l1Cache.keys().length : 0;
    const l2Size = this.config.l2Enabled ? await this.l2Cache.size() : 0;

    return this.stats.getDetailedStats(l1Size, l2Size);
  }

  /**
   * Resets cache statistics
   */
  public resetStats(): void {
    this.stats.reset();
    logger.info('Cache statistics reset');
  }

  /**
   * Performs cache cleanup (removes expired entries)
   */
  public async cleanup(): Promise<void> {
    try {
      if (this.config.l2Enabled) {
        const cleaned = await this.l2Cache.cleanup();
        if (cleaned > 0) {
          logger.info('Cache cleanup completed', { entriesCleaned: cleaned });
        }
      }
    } catch (error) {
      logger.error('Cache cleanup error', { error });
    }
  }

  /**
   * Shuts down the cache manager
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    await this.cleanup();
    logger.info('Cache manager shut down');
  }

  /**
   * Starts the cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error('Scheduled cleanup failed', { error });
      });
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Checks if a key matches a pattern
   * @param key - Cache key
   * @param pattern - Pattern with wildcards (*)
   * @returns True if matches
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/:/g, '\\:');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }
}

// Made with Bob