import type { ResourceInstance, UsageResourceRecord, AccountResource } from '../types/ibm-cloud.types';
import type {
  CorrelatedData,
  CorrelationOptions,
  CorrelationResult,
  CorrelationStats,
  UserSpending,
  MonthlySpending,
} from '../types/correlation.types';
import { logger } from '../utils/logger';

/**
 * Service for correlating resource and usage data
 */
export class DataCorrelatorService {
  /**
   * Correlates resources with their usage data
   * @param resources - Array of resource instances
   * @param usageRecords - Array of usage records
   * @param options - Correlation options
   * @returns Correlation result with matched data and statistics
   */
  public correlateData(
    resources: ResourceInstance[],
    usageRecords: UsageResourceRecord[],
    options: CorrelationOptions = {},
  ): CorrelationResult {
    logger.info('Starting data correlation', {
      resourceCount: resources.length,
      usageRecordCount: usageRecords.length,
    });

    const { includeUnmatched = true, extractCreatorEmail = true, aggregateByUser = true } = options;

    // Create lookup maps for efficient matching
    const usageByResourceId = this.createUsageLookupMap(usageRecords);

    // Correlate each resource with its usage
    const correlatedData: CorrelatedData[] = [];
    const matchStats = {
      resource_id: 0,
      resource_instance_id: 0,
      crn: 0,
    };

    for (const resource of resources) {
      const { usage, matchedBy } = this.findMatchingUsage(resource, usageByResourceId);

      if (matchedBy !== 'none') {
        matchStats[matchedBy]++;
      }

      // Skip unmatched resources if not requested
      if (!includeUnmatched && !usage) {
        continue;
      }

      const totalCost = usage
        ? (usage.billable_charges || 0) + (usage.non_billable_charges || 0)
        : 0;

      const correlated: CorrelatedData = {
        resource,
        usage,
        matchedBy,
        creatorEmail: extractCreatorEmail ? this.extractCreatorEmail(resource) : undefined,
        totalCost,
        currency: usage?.currency || 'USD',
      };

      correlatedData.push(correlated);
    }

    // Calculate statistics
    const stats: CorrelationStats = {
      totalResources: resources.length,
      matchedResources: correlatedData.filter((d) => d.usage !== null).length,
      unmatchedResources: correlatedData.filter((d) => d.usage === null).length,
      matchRate:
        resources.length > 0
          ? (correlatedData.filter((d) => d.usage !== null).length / resources.length) * 100
          : 0,
      matchedBy: matchStats,
    };

    // Aggregate by user if requested
    const userSpending = aggregateByUser ? this.aggregateByUser(correlatedData) : [];

    const result: CorrelationResult = {
      correlatedData,
      userSpending,
      stats,
      correlatedAt: new Date(),
    };

    logger.info('Data correlation completed', {
      totalResources: stats.totalResources,
      matchedResources: stats.matchedResources,
      matchRate: stats.matchRate.toFixed(2) + '%',
      userCount: userSpending.length,
    });

    return result;
  }

  /**
   * Creates lookup maps for efficient usage matching
   * @param usageRecords - Array of usage records
   * @returns Maps for different matching strategies
   */
  private createUsageLookupMap(usageRecords: UsageResourceRecord[]): {
    byResourceId: Map<string, UsageResourceRecord>;
    byInstanceId: Map<string, UsageResourceRecord>;
    byCrn: Map<string, UsageResourceRecord>;
  } {
    const byResourceId = new Map<string, UsageResourceRecord>();
    const byInstanceId = new Map<string, UsageResourceRecord>();
    const byCrn = new Map<string, UsageResourceRecord>();

    for (const record of usageRecords) {
      if (record.resource_id) {
        byResourceId.set(record.resource_id, record);
      }
      if (record.resource_instance_id) {
        byInstanceId.set(record.resource_instance_id, record);
      }
      // CRN matching could be added here if available in usage records
    }

    return { byResourceId, byInstanceId, byCrn };
  }

  /**
   * Correlates resources with resources array from account usage
   * This provides accurate billable_cost for each resource
   * @param resources - Array of resource instances
   * @param accountResources - Array of account resources with costs
   * @param options - Correlation options
   * @returns Correlation result with matched data and statistics
   */
  public correlateWithAccountResources(
    resources: ResourceInstance[],
    accountResources: AccountResource[],
    options: CorrelationOptions = {},
  ): CorrelationResult {
    logger.info('Starting data correlation with account resources', {
      resourceCount: resources.length,
      accountResourceCount: accountResources.length,
    });

    const { includeUnmatched = true, extractCreatorEmail = true, aggregateByUser = true } = options;

    // Create lookup map for account resources by resource_id
    const accountResourceMap = new Map<string, AccountResource>();
    for (const accRes of accountResources) {
      if (accRes.resource_id) {
        accountResourceMap.set(accRes.resource_id, accRes);
      }
    }

    // Correlate each resource with its cost from resources array
    const correlatedData: CorrelatedData[] = [];
    let matchedCount = 0;

    for (const resource of resources) {
      // Try to match by resource ID (GUID)
      const accountResource = accountResourceMap.get(resource.guid);
      
      if (accountResource) {
        matchedCount++;
      }

      // Skip unmatched resources if not requested
      if (!includeUnmatched && !accountResource) {
        continue;
      }

      const totalCost = accountResource ? accountResource.billable_cost : 0;

      // Convert AccountResource to UsageResourceRecord format for compatibility
      const usage: UsageResourceRecord | null = accountResource ? {
        resource_id: accountResource.resource_id,
        resource_instance_id: resource.guid,
        resource_name: accountResource.resource_name || resource.name,
        billable_charges: accountResource.billable_cost,
        non_billable_charges: accountResource.non_billable_cost,
        currency: 'USD', // Account summary uses billing_currency_code
        plan_name: accountResource.plans?.[0]?.plan_name,
        pricing_region: accountResource.plans?.[0]?.pricing_region,
        service_name: resource.name,
      } : null;

      const correlated: CorrelatedData = {
        resource,
        usage,
        matchedBy: accountResource ? 'resource_id' : 'none',
        creatorEmail: extractCreatorEmail ? this.extractCreatorEmail(resource) : undefined,
        totalCost,
        currency: 'USD',
      };

      correlatedData.push(correlated);
    }

    // Calculate statistics
    const stats: CorrelationStats = {
      totalResources: resources.length,
      matchedResources: matchedCount,
      unmatchedResources: resources.length - matchedCount,
      matchRate: resources.length > 0 ? (matchedCount / resources.length) * 100 : 0,
      matchedBy: {
        resource_id: matchedCount,
        resource_instance_id: 0,
        crn: 0,
      },
    };

    // Aggregate by user if requested
    const userSpending = aggregateByUser ? this.aggregateByUser(correlatedData) : [];

    const result: CorrelationResult = {
      correlatedData,
      userSpending,
      stats,
      correlatedAt: new Date(),
    };

    logger.info('Data correlation with account resources completed', {
      totalResources: stats.totalResources,
      matchedResources: stats.matchedResources,
      matchRate: stats.matchRate.toFixed(2) + '%',
      userCount: userSpending.length,
    });

    return result;
  }

  /**
   * Finds matching usage record for a resource
   * @param resource - Resource instance
   * @param lookupMaps - Usage lookup maps
   * @returns Matched usage record and match method
   */
  private findMatchingUsage(
    resource: ResourceInstance,
    lookupMaps: {
      byResourceId: Map<string, UsageResourceRecord>;
      byInstanceId: Map<string, UsageResourceRecord>;
      byCrn: Map<string, UsageResourceRecord>;
    },
  ): {
    usage: UsageResourceRecord | null;
    matchedBy: 'resource_id' | 'resource_instance_id' | 'crn' | 'none';
  } {
    // Try matching by resource ID
    if (resource.id) {
      const usage = lookupMaps.byResourceId.get(resource.id);
      if (usage) {
        return { usage, matchedBy: 'resource_id' };
      }
    }

    // Try matching by GUID (instance ID)
    if (resource.guid) {
      const usage = lookupMaps.byInstanceId.get(resource.guid);
      if (usage) {
        return { usage, matchedBy: 'resource_instance_id' };
      }
    }

    // Try matching by CRN
    if (resource.crn) {
      const usage = lookupMaps.byCrn.get(resource.crn);
      if (usage) {
        return { usage, matchedBy: 'crn' };
      }
    }

    return { usage: null, matchedBy: 'none' };
  }

  /**
   * Extracts creator email from resource metadata
   * @param resource - Resource instance
   * @returns Creator email or undefined
   */
  private extractCreatorEmail(resource: ResourceInstance): string | undefined {
    if (!resource.createdBy) {
      return undefined;
    }

    // IBM Cloud createdBy format: "IBMid-<userid>" or email
    const createdBy = resource.createdBy;

    // If it's already an email, return it
    if (createdBy.includes('@')) {
      return createdBy;
    }

    // If it's an IBMid, we can't extract email without additional API calls
    // Return the IBMid as-is for now
    return createdBy;
  }

  /**
   * Aggregates correlated data by user (creator)
   * @param correlatedData - Array of correlated data
   * @returns Array of user spending summaries
   */
  private aggregateByUser(correlatedData: CorrelatedData[]): UserSpending[] {
    const userMap = new Map<string, CorrelatedData[]>();

    // Group by user
    for (const data of correlatedData) {
      const userEmail = data.creatorEmail || 'unknown';
      const existing = userMap.get(userEmail) || [];
      userMap.set(userEmail, [...existing, data]);
    }

    // Calculate spending per user
    const userSpending: UserSpending[] = [];

    for (const [userEmail, userData] of userMap.entries()) {
      const totalCost = userData.reduce((sum, data) => sum + data.totalCost, 0);
      const currency = userData[0]?.currency || 'USD';

      const resources = userData
        .filter((data) => data.usage !== null)
        .map((data) => ({
          resourceId: data.resource.id,
          resourceName: data.resource.name,
          serviceName: data.usage?.service_name || 'Unknown',
          cost: data.totalCost,
        }));

      const spending: UserSpending = {
        userEmail,
        totalCost,
        currency,
        resourceCount: resources.length,
        resources,
        monthlyBreakdown: [], // Will be populated by separate method
      };

      userSpending.push(spending);
    }

    // Sort by total cost descending
    userSpending.sort((a, b) => b.totalCost - a.totalCost);

    return userSpending;
  }

  /**
   * Generates monthly spending breakdown for a user
   * @param correlatedData - Array of correlated data for a user
   * @param months - Array of months to include
   * @returns Array of monthly spending
   */
  public generateMonthlyBreakdown(
    correlatedData: CorrelatedData[],
    months: string[],
  ): MonthlySpending[] {
    const monthlyMap = new Map<string, { cost: number; count: number }>();

    // Initialize all months
    for (const month of months) {
      monthlyMap.set(month, { cost: 0, count: 0 });
    }

    // This is a simplified version - in reality, we'd need usage data per month
    // For now, we'll distribute costs evenly across months
    const totalCost = correlatedData.reduce((sum, data) => sum + data.totalCost, 0);
    const costPerMonth = totalCost / months.length;

    for (const month of months) {
      monthlyMap.set(month, {
        cost: costPerMonth,
        count: correlatedData.length,
      });
    }

    const breakdown: MonthlySpending[] = [];
    const currency = correlatedData[0]?.currency || 'USD';

    for (const [month, data] of monthlyMap.entries()) {
      breakdown.push({
        month,
        cost: data.cost,
        currency,
        resourceCount: data.count,
      });
    }

    return breakdown;
  }

  /**
   * Filters correlated data by date range
   * @param correlatedData - Array of correlated data
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Filtered correlated data
   */
  public filterByDateRange(
    correlatedData: CorrelatedData[],
    startDate: string,
    endDate: string,
  ): CorrelatedData[] {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return correlatedData.filter((data) => {
      if (!data.resource.createdAt) {
        return false;
      }

      const createdAt = new Date(data.resource.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }

  /**
   * Gets top spenders from user spending data
   * @param userSpending - Array of user spending
   * @param limit - Number of top spenders to return
   * @returns Top spenders
   */
  public getTopSpenders(userSpending: UserSpending[], limit: number = 10): UserSpending[] {
    return userSpending.slice(0, limit);
  }
}

// Made with Bob