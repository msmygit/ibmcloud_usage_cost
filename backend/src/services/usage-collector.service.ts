import type { UsageReportsClient } from '../clients/usage-reports.client';
import type { UsageResourceRecord } from '../types/ibm-cloud.types';
import type {
  UsageReport,
  UsageCollectionOptions,
  MultiMonthUsageReport,
  UsageMetric,
} from '../types/usage.types';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

/**
 * Service for collecting usage and cost data from IBM Cloud Usage Reports API
 */
export class UsageCollectorService {
  public constructor(private readonly usageClient: UsageReportsClient) {}

  /**
   * Collects usage data for a single month
   * @param accountId - IBM Cloud account ID
   * @param month - Billing month in YYYY-MM format
   * @returns Usage report for the month
   */
  public async collectMonthUsage(accountId: string, month: string): Promise<UsageReport> {
    logger.info('Collecting usage for month', { accountId, month });

    try {
      // Fetch account usage which contains all resources with costs
      const accountSummary = await withRetry(
        async () => this.usageClient.getAccountUsage(accountId, month),
        {
          attempts: 3,
          minTimeoutMs: 1000,
          maxTimeoutMs: 10000,
          factor: 2,
        },
        {
          operation: 'getAccountUsage',
          service: 'UsageCollector',
        },
      );

      // Use account summary resources which have complete cost data
      const resources = accountSummary.resources || [];
      const totalCost = this.calculateTotalCost(resources);
      const currency = accountSummary.billing_currency_code || 'USD';

      const report: UsageReport = {
        accountId,
        billingMonth: month,
        startDate: `${month}-01`,
        endDate: this.getMonthEndDate(month),
        resources,
        totalCost,
        currency,
      };

      logger.info('Usage collection completed for month', {
        accountId,
        month,
        resourceCount: resources.length,
        totalCost,
      });

      return report;
    } catch (error) {
      logger.error('Failed to collect usage for month', { accountId, month, error });
      throw error;
    }
  }

  /**
   * Collects usage data for a date range (multiple months)
   * @param accountId - IBM Cloud account ID
   * @param options - Collection options with start and end months
   * @returns Multi-month usage report
   */
  public async collectUsageRange(
    accountId: string,
    options: UsageCollectionOptions,
  ): Promise<MultiMonthUsageReport> {
    const { startMonth, endMonth, onProgress } = options;
    logger.info('Collecting usage for date range', { accountId, startMonth, endMonth });

    try {
      const months = this.generateMonthRange(startMonth, endMonth);
      const totalMonths = months.length;

      logger.debug('Generated month range', { months, count: totalMonths });

      // Collect usage for each month concurrently with rate limiting
      const monthReports: UsageReport[] = [];
      const batchSize = 3; // Process 3 months at a time to avoid rate limits

      for (let i = 0; i < months.length; i += batchSize) {
        const batch = months.slice(i, i + batchSize);
        const batchPromises = batch.map((month) => this.collectMonthUsage(accountId, month));

        const batchResults = await Promise.all(batchPromises);
        monthReports.push(...batchResults);

        if (onProgress && batch.length > 0) {
          const lastMonth = batch[batch.length - 1];
          if (lastMonth) {
            onProgress(lastMonth, monthReports.length, totalMonths);
          }
        }
      }

      const totalCost = monthReports.reduce((sum, report) => sum + report.totalCost, 0);
      const currency = monthReports[0]?.currency || 'USD';

      const multiMonthReport: MultiMonthUsageReport = {
        accountId,
        startMonth,
        endMonth,
        months: monthReports,
        totalCost,
        currency,
        collectedAt: new Date(),
      };

      logger.info('Usage collection completed for date range', {
        accountId,
        startMonth,
        endMonth,
        monthCount: monthReports.length,
        totalCost,
      });

      return multiMonthReport;
    } catch (error) {
      logger.error('Failed to collect usage for date range', {
        accountId,
        startMonth,
        endMonth,
        error,
      });
      throw error;
    }
  }

  /**
   * Extracts usage metrics from a usage record
   * @param record - Usage resource record
   * @returns Extracted usage metric
   */
  public extractUsageMetric(record: UsageResourceRecord): UsageMetric {
    // Support both field name variants for backward compatibility
    const billableCharges = record.billable_cost || record.billable_charges || 0;
    const nonBillableCharges = record.non_billable_cost || record.non_billable_charges || 0;

    return {
      resourceId: record.resource_id || 'unknown',
      resourceInstanceId: record.resource_instance_id,
      resourceName: record.resource_name || 'Unknown Resource',
      serviceName: record.service_name || 'Unknown Service',
      planName: record.plan_name || 'Unknown Plan',
      billableCharges,
      nonBillableCharges,
      totalCharges: billableCharges + nonBillableCharges,
      currency: record.currency || 'USD',
      pricingRegion: record.pricing_region,
      resourceGroupName: record.resource_group_name,
    };
  }

  /**
   * Calculates total cost from usage records
   * @param records - Array of usage records
   * @returns Total cost
   */
  private calculateTotalCost(records: UsageResourceRecord[]): number {
    return records.reduce((sum, record) => {
      // Check for top-level cost fields first (from getAccountUsage)
      if (record.billable_cost !== undefined || record.billable_charges !== undefined) {
        const billable = record.billable_cost || record.billable_charges || 0;
        const nonBillable = record.non_billable_cost || record.non_billable_charges || 0;
        return sum + billable + nonBillable;
      }
      
      // Otherwise sum costs from usage array (from getResourceUsageAccount)
      if (record.usage && Array.isArray(record.usage)) {
        const usageCost = record.usage.reduce((usageSum: number, usageItem: any) => {
          return usageSum + (usageItem.cost || 0);
        }, 0);
        return sum + usageCost;
      }
      
      return sum;
    }, 0);
  }

  /**
   * Generates array of months between start and end (inclusive)
   * @param startMonth - Start month in YYYY-MM format
   * @param endMonth - End month in YYYY-MM format
   * @returns Array of month strings
   */
  private generateMonthRange(startMonth: string, endMonth: string): string[] {
    const months: string[] = [];
    const start = new Date(`${startMonth}-01`);
    const end = new Date(`${endMonth}-01`);

    let current = new Date(start);
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  /**
   * Gets the last day of a month
   * @param month - Month in YYYY-MM format
   * @returns End date in YYYY-MM-DD format
   */
  private getMonthEndDate(month: string): string {
    const parts = month.split('-');
    const year = parseInt(parts[0] || '2024', 10);
    const monthNum = parseInt(parts[1] || '1', 10);
    const lastDay = new Date(year, monthNum, 0).getDate();
    return `${month}-${String(lastDay).padStart(2, '0')}`;
  }

  /**
   * Aggregates usage by service name
   * @param records - Array of usage records
   * @returns Map of service name to total cost
   */
  public aggregateByService(records: UsageResourceRecord[]): Map<string, number> {
    const aggregated = new Map<string, number>();

    for (const record of records) {
      const serviceName = record.service_name || 'Unknown';
      const cost = (record.billable_charges || 0) + (record.non_billable_charges || 0);
      const existing = aggregated.get(serviceName) || 0;
      aggregated.set(serviceName, existing + cost);
    }

    return aggregated;
  }

  /**
   * Aggregates usage by resource group
   * @param records - Array of usage records
   * @returns Map of resource group to total cost
   */
  public aggregateByResourceGroup(records: UsageResourceRecord[]): Map<string, number> {
    const aggregated = new Map<string, number>();

    for (const record of records) {
      const groupName = record.resource_group_name || 'Unknown';
      const cost = (record.billable_charges || 0) + (record.non_billable_charges || 0);
      const existing = aggregated.get(groupName) || 0;
      aggregated.set(groupName, existing + cost);
    }

    return aggregated;
  }
}

// Made with Bob