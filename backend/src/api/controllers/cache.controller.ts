import type { Request, Response, NextFunction } from 'express';
import { CacheManager } from '../../cache/cache-manager';
import { logger } from '../../utils/logger';

/**
 * Controller for cache management endpoints
 */
export class CacheController {
  private readonly cacheManager: CacheManager;

  public constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * GET /api/cache/stats
   * Gets cache statistics
   */
  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Getting cache statistics');

      const stats = await this.cacheManager.getStats();

      res.json({
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      next(error);
    }
  }

  /**
   * POST /api/cache/clear
   * Clears all cache entries
   */
  public async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern } = req.body;

      if (pattern) {
        logger.info('Clearing cache by pattern', { pattern });
        const deletedCount = await this.cacheManager.clearPattern(pattern);

        res.json({
          message: 'Cache cleared by pattern',
          pattern,
          deletedCount,
        });
      } else {
        logger.info('Clearing all cache');
        await this.cacheManager.clear();

        res.json({
          message: 'All cache cleared',
        });
      }
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      next(error);
    }
  }

  /**
   * POST /api/cache/cleanup
   * Runs cache cleanup (removes expired entries)
   */
  public async cleanup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Running cache cleanup');

      await this.cacheManager.cleanup();

      res.json({
        message: 'Cache cleanup completed',
      });
    } catch (error) {
      logger.error('Failed to run cache cleanup', { error });
      next(error);
    }
  }

  /**
   * POST /api/cache/reset-stats
   * Resets cache statistics
   */
  public async resetStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Resetting cache statistics');

      this.cacheManager.resetStats();

      res.json({
        message: 'Cache statistics reset',
      });
    } catch (error) {
      logger.error('Failed to reset cache stats', { error });
      next(error);
    }
  }
}

// Made with Bob