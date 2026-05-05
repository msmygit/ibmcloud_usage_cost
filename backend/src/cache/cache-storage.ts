import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  readonly key: string;
  readonly value: T;
  readonly ttl: number; // Time to live in milliseconds
  readonly createdAt: number; // Timestamp
  readonly expiresAt: number; // Timestamp
}

/**
 * File-based cache storage (L2 cache)
 */
export class FileCacheStorage {
  private readonly cacheDir: string;

  public constructor(cacheDir: string = '.cache') {
    this.cacheDir = path.resolve(process.cwd(), cacheDir);
  }

  /**
   * Initializes the cache directory
   */
  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('File cache storage initialized', { cacheDir: this.cacheDir });
    } catch (error) {
      logger.error('Failed to initialize file cache storage', { error });
      throw error;
    }
  }

  /**
   * Gets a value from the cache
   * @param key - Cache key
   * @returns Cached value or null if not found or expired
   */
  public async get<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(data);

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        logger.debug('Cache entry expired', { key });
        await this.delete(key);
        return null;
      }

      logger.debug('Cache hit (L2)', { key });
      return entry.value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Cache miss (L2)', { key });
        return null;
      }

      logger.error('Failed to read from file cache', { key, error });
      return null;
    }
  }

  /**
   * Sets a value in the cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds
   */
  public async set<T>(key: string, value: T, ttl: number): Promise<void> {
    const filePath = this.getFilePath(key);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: now,
      expiresAt: now + ttl,
    };

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write to file
      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
      logger.debug('Cache set (L2)', { key, ttl });
    } catch (error) {
      logger.error('Failed to write to file cache', { key, error });
      throw error;
    }
  }

  /**
   * Deletes a value from the cache
   * @param key - Cache key
   */
  public async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
      logger.debug('Cache delete (L2)', { key });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to delete from file cache', { key, error });
      }
    }
  }

  /**
   * Clears all cache entries
   */
  public async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('File cache cleared');
    } catch (error) {
      logger.error('Failed to clear file cache', { error });
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
      const files = await this.getAllFiles();

      for (const file of files) {
        const key = this.keyFromFilePath(file);
        if (this.matchesPattern(key, pattern)) {
          await this.delete(key);
          deletedCount++;
        }
      }

      logger.info('Cleared cache entries by pattern', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to clear cache by pattern', { pattern, error });
      throw error;
    }
  }

  /**
   * Gets the number of cache entries
   * @returns Number of entries
   */
  public async size(): Promise<number> {
    try {
      const files = await this.getAllFiles();
      return files.length;
    } catch (error) {
      logger.error('Failed to get cache size', { error });
      return 0;
    }
  }

  /**
   * Gets all cache keys
   * @returns Array of cache keys
   */
  public async keys(): Promise<string[]> {
    try {
      const files = await this.getAllFiles();
      return files.map((file) => this.keyFromFilePath(file));
    } catch (error) {
      logger.error('Failed to get cache keys', { error });
      return [];
    }
  }

  /**
   * Cleans up expired cache entries
   * @returns Number of entries cleaned
   */
  public async cleanup(): Promise<number> {
    let cleanedCount = 0;

    try {
      const files = await this.getAllFiles();

      for (const file of files) {
        try {
          const data = await fs.readFile(file, 'utf-8');
          const entry: CacheEntry<unknown> = JSON.parse(data);

          if (Date.now() > entry.expiresAt) {
            await fs.unlink(file);
            cleanedCount++;
          }
        } catch (error) {
          // Skip invalid files
          logger.debug('Skipping invalid cache file', { file });
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired cache entries', { cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup cache', { error });
      return 0;
    }
  }

  /**
   * Gets the file path for a cache key
   * @param key - Cache key
   * @returns File path
   */
  private getFilePath(key: string): string {
    // Replace colons with slashes for directory structure
    const sanitized = key.replace(/:/g, '/');
    return path.join(this.cacheDir, `${sanitized}.json`);
  }

  /**
   * Extracts cache key from file path
   * @param filePath - File path
   * @returns Cache key
   */
  private keyFromFilePath(filePath: string): string {
    const relative = path.relative(this.cacheDir, filePath);
    return relative.replace(/\.json$/, '').replace(/\//g, ':');
  }

  /**
   * Gets all cache files recursively
   * @returns Array of file paths
   */
  private async getAllFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist yet
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    };

    await walk(this.cacheDir);
    return files;
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