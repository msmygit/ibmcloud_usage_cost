import type { Request, Response, NextFunction } from 'express';
import { ClientFactory } from '../../clients/client-factory';
import { UsageCollectorService } from '../../services/usage-collector.service';
import { CacheManager, CacheTTL } from '../../cache/cache-manager';
import { CacheKeyGenerator } from '../../cache/cache-keys';
import { logger } from '../../utils/logger';
import { ibmCloudConfig } from '../../config/ibm-cloud.config';

/**
 * Controller for usage-related endpoints
 */
export class UsageController {
  private readonly clientFactory: ClientFactory;
  private readonly cacheManager: CacheManager;

  public constructor(clientFactory: ClientFactory, cacheManager: CacheManager) {
    this.clientFactory = clientFactory;
    this.cacheManager = cacheManager;
  }

  /**
   * GET /api/usage
   * Gets usage data for an account and time period
   */
  public async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId: queryAccountId, startMonth, endMonth, month } = req.query;

      // Use accountId from query or fall back to config
      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required or must be configured in environment',
        });
        return;
      }

      // Single month or range
      const isSingleMonth = month && !startMonth && !endMonth;
      const isRange = startMonth && endMonth;

      if (!isSingleMonth && !isRange) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Either "month" or both "startMonth" and "endMonth" are required',
        });
        return;
      }

      const usageClient = this.clientFactory.createUsageReportsClient();
      const collector = new UsageCollectorService(usageClient);

      if (isSingleMonth) {
        // Single month usage
        const monthStr = month as string;
        logger.info('Getting usage for month', {
          accountId,
          accountIdSource: queryAccountId ? 'query' : 'config',
          month: monthStr,
        });

        const cacheKey = CacheKeyGenerator.forUsage(accountId, monthStr);
        const usageReport = await this.cacheManager.getOrSet(
          cacheKey,
          async () => await collector.collectMonthUsage(accountId, monthStr),
          CacheTTL.USAGE,
        );

        res.json({
          accountId,
          month: monthStr,
          usage: usageReport,
          cached: true,
        });
      } else {
        // Date range usage
        const start = startMonth as string;
        const end = endMonth as string;
        logger.info('Getting usage for range', {
          accountId,
          accountIdSource: queryAccountId ? 'query' : 'config',
          startMonth: start,
          endMonth: end,
        });

        const cacheKey = CacheKeyGenerator.forUsageRange(accountId, start, end);
        const multiMonthReport = await this.cacheManager.getOrSet(
          cacheKey,
          async () =>
            await collector.collectUsageRange(accountId, {
              startMonth: start,
              endMonth: end,
            }),
          CacheTTL.USAGE,
        );

        res.json({
          accountId,
          startMonth: start,
          endMonth: end,
          usage: multiMonthReport,
          cached: true,
        });
      }
    } catch (error) {
      logger.error('Failed to get usage', { error });
      next(error);
    }
  }

  /**
   * GET /api/usage/summary
   * Gets aggregated usage summary
   */
  public async getUsageSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId: queryAccountId, startMonth, endMonth } = req.query;

      // Use accountId from query or fall back to config
      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required or must be configured in environment',
        });
        return;
      }

      if (!startMonth || !endMonth) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Both startMonth and endMonth are required',
        });
        return;
      }

      logger.info('Getting usage summary', {
        accountId,
        accountIdSource: queryAccountId ? 'query' : 'config',
        startMonth,
        endMonth,
      });

      const usageClient = this.clientFactory.createUsageReportsClient();
      const collector = new UsageCollectorService(usageClient);

      const cacheKey = CacheKeyGenerator.forUsageRange(
        accountId,
        startMonth as string,
        endMonth as string,
      );

      const multiMonthReport = await this.cacheManager.getOrSet(
        cacheKey,
        async () =>
          await collector.collectUsageRange(accountId, {
            startMonth: startMonth as string,
            endMonth: endMonth as string,
          }),
        CacheTTL.USAGE,
      );

      // Aggregate by service
      const allResources = multiMonthReport.months.flatMap((m) => m.resources);
      const byService = collector.aggregateByService(allResources);
      const byResourceGroup = collector.aggregateByResourceGroup(allResources);

      res.json({
        accountId,
        startMonth,
        endMonth,
        totalCost: multiMonthReport.totalCost,
        currency: multiMonthReport.currency,
        monthCount: multiMonthReport.months.length,
        byService: Object.fromEntries(byService),
        byResourceGroup: Object.fromEntries(byResourceGroup),
        cached: true,
      });
    } catch (error) {
      logger.error('Failed to get usage summary', { error });
      next(error);
    }
  }
}

// Made with Bob