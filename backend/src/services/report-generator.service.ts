import { addMonths, format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import type {
  UserSpendingReport,
  TeamSpendingReport,
  ReportGenerationOptions,
  CostBreakdown,
  TrendAnalysis,
  TrendDataPoint,
  ForecastDataPoint,
  DateRange,
} from '../types/report.types';
import type { CorrelatedData, UserSpending } from '../types/correlation.types';
import { ResourceCollectorService } from './resource-collector.service';
import { UsageCollectorService } from './usage-collector.service';
import { DataCorrelatorService } from './data-correlator.service';
import { CacheManager } from '../cache/cache-manager';
import { clientFactory } from '../clients/client-factory';
import { UserManagementClient } from '../clients/user-management.client';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';

/**
 * Service for generating comprehensive spending reports
 */
export class ReportGeneratorService {
  private resourceCollector: ResourceCollectorService;
  private usageCollector: UsageCollectorService;
  private dataCorrelator: DataCorrelatorService;
  private cacheManager: CacheManager;
  private userManagementClient: UserManagementClient;

  constructor(
    resourceCollector?: ResourceCollectorService,
    usageCollector?: UsageCollectorService,
    dataCorrelator?: DataCorrelatorService,
    cacheManager?: CacheManager,
    userManagementClient?: UserManagementClient,
  ) {
    // Create clients if not provided
    const resourceClient = clientFactory.createResourceControllerClient();
    const usageClient = clientFactory.createUsageReportsClient();
    
    this.resourceCollector = resourceCollector || new ResourceCollectorService(resourceClient);
    this.usageCollector = usageCollector || new UsageCollectorService(usageClient);
    this.dataCorrelator = dataCorrelator || new DataCorrelatorService();
    this.cacheManager = cacheManager || new CacheManager();
    this.userManagementClient = userManagementClient || clientFactory.createUserManagementClient();
  }

  /**
   * Generates a user spending report
   */
  public async generateUserSpendingReport(
    options: ReportGenerationOptions,
    progressCallback?: (progress: number, step: string) => void,
    reportId?: string,
  ): Promise<UserSpendingReport> {
    const finalReportId = reportId || crypto.randomUUID();
    const startTime = Date.now();

    logger.info({ reportId: finalReportId, options }, 'Starting user spending report generation');

    try {
      // Calculate date range
      const dateRange = this.calculateDateRange(options.period, options.dateRange);
      progressCallback?.(10, 'collecting_resources');

      // Collect resources
      const resources = await this.resourceCollector.collectResources(options.accountId, {
        resourceGroupId: options.filters?.resourceGroups?.[0],
      });
      progressCallback?.(30, 'collecting_usage');

      // Collect usage data for the date range
      const months = this.getMonthsInRange(dateRange);
      
      // Get account usage with resources for accurate cost correlation
      const usageClient = clientFactory.createUsageReportsClient();
      const latestMonth = months[months.length - 1] || format(new Date(), 'yyyy-MM');
      const accountUsage = await usageClient.getAccountUsage(options.accountId, latestMonth);
      
      progressCallback?.(50, 'correlating_data');

      // Correlate data using resources which has accurate billable_cost
      const correlationResult = this.dataCorrelator.correlateWithAccountResources(
        resources,
        accountUsage.resources || [],
        {
          includeUnmatched: false,
          extractCreatorEmail: true,
          aggregateByUser: true,
        }
      );
      progressCallback?.(70, 'calculating_trends');

      // Apply filters
      let filteredData = correlationResult.correlatedData;
      if (options.filters) {
        filteredData = this.applyFilters(filteredData, options.filters);
      }

      // Recalculate user spending with filtered data
      let userSpending = this.aggregateUserSpending(filteredData, months);
      
      // Enrich user spending with user profiles
      userSpending = await this.enrichUserSpending(options.accountId, userSpending);
      progressCallback?.(80, 'generating_forecasts');

      // Calculate cost breakdown
      const costBreakdown = this.calculateCostBreakdown(filteredData);

      // Calculate monthly trend
      const monthlyTrend = this.calculateMonthlyTrend(filteredData, months);

      // Generate forecasts if requested
      let trendAnalysis: TrendAnalysis | undefined;
      if (options.includeForecasts) {
        trendAnalysis = this.generateTrendAnalysis(
          monthlyTrend,
          options.forecastMonths || 3,
        );
      }
      progressCallback?.(90, 'finalizing');

      // Calculate top spenders
      const topSpenders = userSpending.slice(0, 10).map((user) => ({
        userEmail: user.userEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        iamId: user.iamId,
        totalCost: user.totalCost,
        resourceCount: user.resourceCount,
        percentage: (user.totalCost / userSpending.reduce((sum, u) => sum + u.totalCost, 0)) * 100,
      }));

      // Calculate summary
      const totalCost = userSpending.reduce((sum, user) => sum + user.totalCost, 0);
      const summary = {
        totalCost,
        totalUsers: userSpending.length,
        totalResources: filteredData.length,
        averageCostPerUser: userSpending.length > 0 ? totalCost / userSpending.length : 0,
        currency: filteredData[0]?.currency || 'USD',
      };

      const report: UserSpendingReport = {
        type: 'user-spending',
        reportId: finalReportId,
        generatedAt: new Date(),
        accountId: options.accountId,
        period: options.period,
        dateRange,
        filters: options.filters,
        status: 'completed',
        users: userSpending,
        topSpenders,
        summary,
        costBreakdown,
        monthlyTrend,
      };

      // Cache the report
      await this.cacheReport(finalReportId, report);
      progressCallback?.(100, 'complete');

      const duration = Date.now() - startTime;
      logger.info({ reportId: finalReportId, duration }, 'User spending report generated successfully');

      return report;
    } catch (error) {
      logger.error({ reportId: finalReportId, error }, 'Failed to generate user spending report');
      throw new AppError(
        'Failed to generate user spending report',
        'REPORT_GENERATION_FAILED',
        500,
        { cause: error },
      );
    }
  }

  /**
   * Generates a team spending report
   */
  public async generateTeamSpendingReport(
    options: ReportGenerationOptions & { teamName?: string },
    progressCallback?: (progress: number, step: string) => void,
    reportId?: string,
  ): Promise<TeamSpendingReport> {
    const finalReportId = reportId || crypto.randomUUID();
    const startTime = Date.now();

    logger.info({ reportId: finalReportId, options }, 'Starting team spending report generation');

    try {
      // Generate user spending report first
      const userReport = await this.generateUserSpendingReport(options, (progress, step) => {
        // Scale progress to 0-80%
        progressCallback?.(progress * 0.8, step);
      });

      progressCallback?.(85, 'aggregating_results');

      // Calculate team-level aggregations
      const totalCost = userReport.summary.totalCost;
      const currency = userReport.summary.currency;

      // Generate trend analysis
      const trendAnalysis = this.generateTrendAnalysis(
        userReport.monthlyTrend,
        options.forecastMonths || 3,
      );

      // Calculate top services
      const topServices = this.calculateTopServices(userReport.costBreakdown);

      // Calculate top users
      const topUsers = userReport.topSpenders.map((spender) => ({
        userEmail: spender.userEmail,
        cost: spender.totalCost,
        percentage: spender.percentage,
      }));

      progressCallback?.(95, 'finalizing');

      const report: TeamSpendingReport = {
        type: 'team-spending',
        reportId: finalReportId,
        generatedAt: new Date(),
        accountId: options.accountId,
        period: options.period,
        dateRange: userReport.dateRange,
        filters: options.filters,
        status: 'completed',
        teamName: options.teamName,
        totalCost,
        currency,
        userCount: userReport.summary.totalUsers,
        resourceCount: userReport.summary.totalResources,
        costBreakdown: userReport.costBreakdown,
        trendAnalysis,
        topServices,
        topUsers,
      };

      // Cache the report
      await this.cacheReport(finalReportId, report);
      progressCallback?.(100, 'complete');

      const duration = Date.now() - startTime;
      logger.info({ reportId: finalReportId, duration }, 'Team spending report generated successfully');

      return report;
    } catch (error) {
      logger.error({ reportId: finalReportId, error }, 'Failed to generate team spending report');
      throw new AppError(
        'Failed to generate team spending report',
        'REPORT_GENERATION_FAILED',
        500,
        { cause: error },
      );
    }
  }

  /**
   * Retrieves a cached report
   */
  public async getReport(reportId: string): Promise<UserSpendingReport | TeamSpendingReport | null> {
    const cacheKey = `report:${reportId}`;
    return await this.cacheManager.get(cacheKey);
  }

  /**
   * Calculates date range based on period
   */
  private calculateDateRange(period: string, customRange?: DateRange): DateRange {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfMonth(now);

    switch (period) {
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfMonth(addMonths(now, -3));
        break;
      case 'year':
        startDate = startOfMonth(addMonths(now, -12));
        break;
      case 'custom':
        if (!customRange) {
          throw new AppError('INVALID_DATE_RANGE', 'Custom range requires dateRange parameter', 400);
        }
        return customRange;
      default:
        startDate = startOfMonth(addMonths(now, -6));
    }

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  }

  /**
   * Gets list of months in a date range
   */
  private getMonthsInRange(dateRange: DateRange): string[] {
    const months: string[] = [];
    let current = startOfMonth(parseISO(dateRange.startDate));
    const end = startOfMonth(parseISO(dateRange.endDate));

    while (current <= end) {
      months.push(format(current, 'yyyy-MM'));
      current = addMonths(current, 1);
    }

    return months;
  }

  /**
   * Applies filters to correlated data
   */
  private applyFilters(data: CorrelatedData[], filters: any): CorrelatedData[] {
    let filtered = data;

    if (filters.userEmails?.length) {
      filtered = filtered.filter((d) => filters.userEmails.includes(d.creatorEmail));
    }

    if (filters.serviceNames?.length) {
      filtered = filtered.filter((d) => filters.serviceNames.includes(d.usage?.service_name));
    }

    if (filters.minCost !== undefined) {
      filtered = filtered.filter((d) => d.totalCost >= filters.minCost);
    }

    if (filters.maxCost !== undefined) {
      filtered = filtered.filter((d) => d.totalCost <= filters.maxCost);
    }

    return filtered;
  }

  /**
   * Aggregates spending by user
   */
  private aggregateUserSpending(data: CorrelatedData[], months: string[]): UserSpending[] {
    const userMap = new Map<string, CorrelatedData[]>();

    for (const item of data) {
      const email = item.creatorEmail || 'unknown';
      const existing = userMap.get(email) || [];
      userMap.set(email, [...existing, item]);
    }

    const userSpending: UserSpending[] = [];

    for (const [userEmail, userData] of userMap.entries()) {
      const totalCost = userData.reduce((sum, d) => sum + d.totalCost, 0);
      const currency = userData[0]?.currency || 'USD';

      const resources = userData.map((d) => ({
        resourceId: d.resource.id,
        resourceName: d.resource.name,
        serviceName: d.usage?.service_name || 'Unknown',
        cost: d.totalCost,
      }));

      const monthlyBreakdown = this.dataCorrelator.generateMonthlyBreakdown(userData, months);

      userSpending.push({
        userEmail,
        totalCost,
        currency,
        resourceCount: resources.length,
        resources,
        monthlyBreakdown,
      });
    }

    return userSpending.sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Calculates cost breakdown by service, region, and resource group
   */
  private calculateCostBreakdown(data: CorrelatedData[]): CostBreakdown {
    const totalCost = data.reduce((sum, d) => sum + d.totalCost, 0);

    // By service
    const serviceMap = new Map<string, { cost: number; count: number }>();
    for (const item of data) {
      const service = item.usage?.service_name || 'Unknown';
      const existing = serviceMap.get(service) || { cost: 0, count: 0 };
      serviceMap.set(service, {
        cost: existing.cost + item.totalCost,
        count: existing.count + 1,
      });
    }

    const byService = Array.from(serviceMap.entries())
      .map(([serviceName, data]) => ({
        serviceName,
        cost: data.cost,
        percentage: (data.cost / totalCost) * 100,
        resourceCount: data.count,
      }))
      .sort((a, b) => b.cost - a.cost);

    // By region
    const regionMap = new Map<string, { cost: number; count: number }>();
    for (const item of data) {
      const region = item.resource.regionId || 'global';
      const existing = regionMap.get(region) || { cost: 0, count: 0 };
      regionMap.set(region, {
        cost: existing.cost + item.totalCost,
        count: existing.count + 1,
      });
    }

    const byRegion = Array.from(regionMap.entries())
      .map(([region, data]) => ({
        region,
        cost: data.cost,
        percentage: (data.cost / totalCost) * 100,
        resourceCount: data.count,
      }))
      .sort((a, b) => b.cost - a.cost);

    // By resource group
    const groupMap = new Map<string, { cost: number; count: number }>();
    for (const item of data) {
      const group = item.resource.resourceGroupId || 'default';
      const existing = groupMap.get(group) || { cost: 0, count: 0 };
      groupMap.set(group, {
        cost: existing.cost + item.totalCost,
        count: existing.count + 1,
      });
    }

    const byResourceGroup = Array.from(groupMap.entries())
      .map(([resourceGroup, data]) => ({
        resourceGroup,
        cost: data.cost,
        percentage: (data.cost / totalCost) * 100,
        resourceCount: data.count,
      }))
      .sort((a, b) => b.cost - a.cost);

    return { byService, byRegion, byResourceGroup };
  }

  /**
   * Calculates monthly trend from correlated data
   */
  private calculateMonthlyTrend(data: CorrelatedData[], months: string[]): TrendDataPoint[] {
    const monthMap = new Map<string, { cost: number; resources: Set<string>; users: Set<string> }>();

    // Initialize months
    for (const month of months) {
      monthMap.set(month, { cost: 0, resources: new Set(), users: new Set() });
    }

    // Aggregate data (simplified - in reality would need monthly usage data)
    const costPerMonth = data.reduce((sum, d) => sum + d.totalCost, 0) / months.length;
    for (const month of months) {
      const monthData = monthMap.get(month)!;
      monthData.cost = costPerMonth;
      for (const item of data) {
        monthData.resources.add(item.resource.id);
        if (item.creatorEmail) {
          monthData.users.add(item.creatorEmail);
        }
      }
    }

    return Array.from(monthMap.entries()).map(([period, data], index, array) => {
      const prevCost = index > 0 ? array[index - 1]?.[1]?.cost ?? 0 : 0;
      const growthRate = index > 0 && prevCost > 0 ? ((data.cost - prevCost) / prevCost) * 100 : 0;
      
      return {
        period,
        cost: data.cost,
        resourceCount: data.resources.size,
        userCount: data.users.size,
        growthRate,
      };
    });
  }

  /**
   * Generates trend analysis with forecasts
   */
  private generateTrendAnalysis(historical: TrendDataPoint[], forecastMonths: number): TrendAnalysis {
    const totalCost = historical.reduce((sum, d) => sum + d.cost, 0);
    const averageMonthlyCost = totalCost / historical.length;

    // Simple linear regression for trend
    const n = historical.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = historical.reduce((sum, d) => sum + d.cost, 0);
    const sumXY = historical.reduce((sum, d, i) => sum + (i + 1) * d.cost, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < averageMonthlyCost * 0.05) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Calculate growth rate
    const firstCost = historical[0]?.cost || 0;
    const lastCost = historical[historical.length - 1]?.cost || 0;
    const growthRate = firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0;

    // Generate forecasts
    const forecast: ForecastDataPoint[] = [];
    const lastMonth = parseISO(historical[historical.length - 1]?.period + '-01' || new Date().toISOString());
    const stdDev = this.calculateStandardDeviation(historical.map((d) => d.cost));

    for (let i = 1; i <= forecastMonths; i++) {
      const predictedCost = slope * (n + i) + intercept;
      const margin = 1.96 * stdDev; // 95% confidence interval

      forecast.push({
        period: format(addMonths(lastMonth, i), 'yyyy-MM'),
        predictedCost: Math.max(0, predictedCost),
        confidenceInterval: {
          lower: Math.max(0, predictedCost - margin),
          upper: predictedCost + margin,
        },
      });
    }

    return {
      historical,
      forecast,
      averageMonthlyCost,
      totalCost,
      growthRate,
      trend,
    };
  }

  /**
   * Calculates standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculates top services from cost breakdown
   */
  private calculateTopServices(breakdown: CostBreakdown): Array<{ serviceName: string; cost: number; percentage: number }> {
    return breakdown.byService.slice(0, 10);
  }

  /**
   * Enriches user spending data with user profiles
   */
  private async enrichUserSpending(
    accountId: string,
    userSpending: UserSpending[],
  ): Promise<UserSpending[]> {
    try {
      // Extract unique IAM IDs using created_by / iamId when present, otherwise derive from userEmail
      const iamIds = userSpending
        .map((user) => user.iamId || UserManagementClient.extractIamIdFromEmail(user.userEmail))
        .filter((id, index, self) => Boolean(id) && self.indexOf(id) === index);

      logger.info({ accountId, userCount: iamIds.length }, 'Fetching user profiles');

      // Fetch user profiles in batch
      const userProfiles = await this.userManagementClient.getUserProfiles(accountId, iamIds);

      // Enrich user spending with profile data
      return userSpending.map((user) => {
        const lookupIamId = user.iamId || UserManagementClient.extractIamIdFromEmail(user.userEmail);
        const profile = userProfiles.get(lookupIamId);

        if (profile) {
          return {
            ...user,
            userEmail: profile.email || user.userEmail,
            firstName: profile.firstName,
            lastName: profile.lastName,
            iamId: profile.iamId,
          };
        }

        return user;
      });
    } catch (error) {
      // Log error but don't fail the report generation
      logger.warn({ accountId, error }, 'Failed to enrich user spending with profiles');
      return userSpending;
    }
  }

  /**
   * Caches a generated report
   */
  private async cacheReport(reportId: string, report: UserSpendingReport | TeamSpendingReport): Promise<void> {
    const cacheKey = `report:${reportId}`;
    const ttl = 30 * 60 * 1000; // 30 minutes in milliseconds
    await this.cacheManager.set(cacheKey, report, ttl);
  }
}

// Export singleton instance
export const reportGeneratorService = new ReportGeneratorService();

// Made with Bob