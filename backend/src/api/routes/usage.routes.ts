import { Router } from 'express';
import type { UsageController } from '../controllers/usage.controller';
import type { CacheManager } from '../../cache/cache-manager';
import { AccountSummaryController } from '../controllers/account-summary.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { UsageQuerySchema } from '../schemas/query.schemas';
import { z } from 'zod';

/**
 * Creates usage routes
 * @param controller - Usage controller instance
 * @param cacheManager - Cache manager instance for account summary
 * @returns Express router
 */
export function createUsageRoutes(controller: UsageController, cacheManager: CacheManager): Router {
  const router = Router();

  /**
   * GET /api/usage
   * Gets usage data for an account and time period
   * Query params:
   * - accountId (required): IBM Cloud account ID
   * - month (optional): Single month in YYYY-MM format
   * - startMonth (optional): Start month in YYYY-MM format (requires endMonth)
   * - endMonth (optional): End month in YYYY-MM format (requires startMonth)
   */
  router.get(
    '/',
    validateRequest({
      query: UsageQuerySchema,
    }),
    (req, res, next) => controller.getUsage(req, res, next)
  );

  /**
   * GET /api/usage/summary
   * Gets aggregated usage summary
   * Query params:
   * - accountId (required): IBM Cloud account ID
   * - startMonth (required): Start month in YYYY-MM format
   * - endMonth (required): End month in YYYY-MM format
   */
  router.get(
    '/summary',
    validateRequest({
      query: z.object({
        accountId: z.string().min(1, 'Account ID is required'),
        startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Start month must be in YYYY-MM format'),
        endMonth: z.string().regex(/^\d{4}-\d{2}$/, 'End month must be in YYYY-MM format'),
      }),
    }),
    (req, res, next) => controller.getUsageSummary(req, res, next)
  );

  /**
   * GET /api/usage/account-summary
   * Gets account usage with resources enriched with creator profiles
   * Query params:
   * - accountId (required): IBM Cloud account ID
   * - month (required): Month in YYYY-MM format
   */
  const accountSummaryController = new AccountSummaryController(cacheManager);
  router.get(
    '/account-summary',
    validateRequest({
      query: z.object({
        accountId: z.string().min(1, 'Account ID is required'),
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
      }),
    }),
    (req, res, next) => accountSummaryController.getAccountSummary(req, res, next)
  );

  return router;
}

// Made with Bob