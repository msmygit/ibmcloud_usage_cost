import { Router } from 'express';
import type { CacheController } from '../controllers/cache.controller';

/**
 * Creates cache management routes
 * @param controller - Cache controller instance
 * @returns Express router
 */
export function createCacheRoutes(controller: CacheController): Router {
  const router = Router();

  /**
   * GET /api/cache/stats
   * Gets cache statistics including hit rate, size, and performance metrics
   */
  router.get('/stats', (req, res, next) => controller.getStats(req, res, next));

  /**
   * POST /api/cache/clear
   * Clears cache entries
   * Body (optional):
   * - pattern: Pattern to match for selective clearing (e.g., "resources:*")
   */
  router.post('/clear', (req, res, next) => controller.clearCache(req, res, next));

  /**
   * POST /api/cache/cleanup
   * Runs cache cleanup to remove expired entries
   */
  router.post('/cleanup', (req, res, next) => controller.cleanup(req, res, next));

  /**
   * POST /api/cache/reset-stats
   * Resets cache statistics counters
   */
  router.post('/reset-stats', (req, res, next) => controller.resetStats(req, res, next));

  return router;
}

// Made with Bob