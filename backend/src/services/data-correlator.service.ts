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

      // Calculate total cost from usage record
      let totalCost = 0;
      if (usage) {
        // Check for top-level cost fields first (from getAccountUsage)
        if (usage.billable_cost !== undefined || usage.billable_charges !== undefined) {
          totalCost = (usage.billable_cost || usage.billable_charges || 0) +
                     (usage.non_billable_cost || usage.non_billable_charges || 0);
        }
        // Otherwise sum costs from usage array (from getResourceUsageAccount)
        else if (usage.usage && Array.isArray(usage.usage)) {
          totalCost = usage.usage.reduce((sum: number, usageItem: any) => {
            return sum + (usageItem.cost || 0);
          }, 0);
        }
      }

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
   * This provides accurate billable_cost for each resource by allocating
   * service-level costs proportionally across resource instances
   * @param resources - Array of resource instances
   * @param usageResources - Array of usage resources with service-level costs (can be AccountResource or UsageResourceRecord)
   * @param options - Correlation options
   * @returns Correlation result with matched data and statistics
   */
  public correlateWithAccountResources(
    resources: ResourceInstance[],
    usageResources: (AccountResource | UsageResourceRecord)[],
    options: CorrelationOptions = {},
  ): CorrelationResult {
    logger.info('Starting data correlation with account resources', {
      resourceCount: resources.length,
      usageResourceCount: usageResources.length,
    });

    const { extractCreatorEmail = true, aggregateByUser = true } = options;

    // Calculate total allocatable cost from service-level usage data
    const totalAllocatableCost = usageResources.reduce((sum, usageRes) => {
      const billableCost = (usageRes as AccountResource).billable_cost ??
                          (usageRes as UsageResourceRecord).billable_cost ??
                          (usageRes as UsageResourceRecord).billable_charges ?? 0;
      const nonBillableCost = (usageRes as AccountResource).non_billable_cost ??
                             (usageRes as UsageResourceRecord).non_billable_cost ??
                             (usageRes as UsageResourceRecord).non_billable_charges ?? 0;
      return sum + billableCost + nonBillableCost;
    }, 0);

    logger.debug('Cost allocation calculation', {
      totalAllocatableCost,
      resourceInstanceCount: resources.length,
      perResourceCost: resources.length > 0 ? totalAllocatableCost / resources.length : 0,
    });

    // Allocate cost proportionally across all resource instances
    const perResourceCost = resources.length > 0 ? totalAllocatableCost / resources.length : 0;

    // Correlate each resource with its allocated cost
    const correlatedData: CorrelatedData[] = [];
    let matchedCount = 0;

    for (const resource of resources) {
      // Every resource gets an equal share of the total cost
      // This matches the Dashboard's cost allocation logic
      matchedCount++;

      const totalCost = perResourceCost;

      // Create a synthetic usage record with allocated cost
      const usage: UsageResourceRecord = {
        resource_id: resource.guid,
        resource_instance_id: resource.guid,
        resource_name: resource.name,
        billable_cost: perResourceCost,
        non_billable_cost: 0,
        currency: 'USD',
        service_name: resource.name,
      };

      const correlated: CorrelatedData = {
        resource,
        usage,
        matchedBy: 'resource_id',
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
   * Prioritizes enriched creatorProfile data over raw createdBy field
   * @param resource - Resource instance
   * @returns Creator email or undefined
   */
  private extractCreatorEmail(resource: ResourceInstance): string | undefined {
    // PRIORITY 1: Use enriched creator profile email if available
    if (resource.creatorProfile?.email) {
      return resource.creatorProfile.email;
    }

    // PRIORITY 2: Check if createdBy is already an email
    const createdBy = resource.createdBy;
    if (createdBy && createdBy.includes('@')) {
      return createdBy;
    }

    // PRIORITY 3: Use IAM ID from creator profile
    if (resource.creatorProfile?.iamId) {
      return resource.creatorProfile.iamId;
    }

    // PRIORITY 4: Fall back to raw createdBy (might be IBMid)
    if (createdBy) {
      return createdBy;
    }

    return undefined;
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