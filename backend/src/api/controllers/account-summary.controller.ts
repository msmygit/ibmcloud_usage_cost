import type { Request, Response, NextFunction } from 'express';
import { clientFactory } from '../../clients/client-factory';
import { ResourceCollectorService } from '../../services/resource-collector.service';
import { UserManagementClient } from '../../clients/user-management.client';
import UsageReportsV4 from '@ibm-cloud/platform-services/usage-reports/v4.js';
import type { AccountResource, ResourceGroup, ResourceInstance as IBMResourceInstance } from '../../types/ibm-cloud.types';
import type {
  HierarchicalCostBreakdown,
  ResourceGroupAggregation,
  CreatorAggregation,
  TypeAggregation,
  SubTypeAggregation,
  ResourceCostDetail,
} from '../../types/resource.types';
import type { CacheManager } from '../../cache/cache-manager';
import { CacheTTL } from '../../cache/cache-manager';
import { CacheKeyGenerator } from '../../cache/cache-keys';
import { logger } from '../../utils/logger';
import { ibmCloudConfig } from '../../config/ibm-cloud.config';

/**
 * Controller for account summary endpoint
 * Returns combined data: usage costs + resources with creator profiles
 */
export class AccountSummaryController {
  constructor(private readonly cacheManager: CacheManager) {}

  /**
   * GET /api/usage/account-summary
   * Gets account usage with resources enriched with creator profiles
   * This endpoint combines:
   * 1. Account-level usage/cost data from IBM Cloud Usage Reports API
   * 2. All resource instances from Resource Controller API
   * 3. User profiles from User Management API
   */
  public async getAccountSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId: queryAccountId, month } = req.query;

      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required',
        });
        return;
      }

      if (!month) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'month query parameter is required (format: YYYY-MM)',
        });
        return;
      }

      logger.info('Getting enriched account summary', { accountId, month });

      // 1. Fetch account usage (costs by service type)
      const usageCacheKey = CacheKeyGenerator.forUsage(accountId, month as string);
      const accountSummary = await this.cacheManager.getOrSet(
        usageCacheKey,
        async () => {
          const usageClient = clientFactory.createUsageReportsClient();
          return await usageClient.getAccountUsage(accountId, month as string);
        },
        CacheTTL.USAGE,
      );

      // 2. Fetch all resources with creator profiles plus resource group names
      const resourceClient = clientFactory.createResourceControllerClient();
      const resourcesCacheKey = CacheKeyGenerator.forResources(accountId);
      const enrichedResources = await this.cacheManager.getOrSet(
        resourcesCacheKey,
        async () => {
          const collector = new ResourceCollectorService(resourceClient);
          const resources = await collector.collectResources(accountId);

          // Enrich with user profiles
          return await this.enrichResourcesWithCreatorProfiles(
            accountId,
            resources,
          );
        },
        CacheTTL.RESOURCES,
      );

      const resourceGroupsCacheKey = `${resourcesCacheKey}:groups`;
      const resourceGroups = await this.cacheManager.getOrSet(
        resourceGroupsCacheKey,
        async () => await resourceClient.listResourceGroups(),
        CacheTTL.RESOURCES,
      );

      const resourceGroupNameById = new Map<string, string>(
        resourceGroups.map((group: ResourceGroup) => [group.id, group.name]),
      );

      const resourceInstances = enrichedResources.map((resource) => ({
        ...resource,
        resourceGroupName: this.resolveResourceGroupName(resource, resourceGroupNameById),
      }));

      // DEBUG: Log first enriched resource instance to trace creator profile data
      if (resourceInstances.length > 0) {
        logger.info('[DEBUG] First enriched resource instance for dashboard:', {
          name: resourceInstances[0].name,
          guid: resourceInstances[0].guid,
          createdBy: resourceInstances[0].createdBy,
          created_by: (resourceInstances[0] as any).created_by,
          creatorProfile: resourceInstances[0].creatorProfile,
          resourceGroupId: resourceInstances[0].resourceGroupId,
          resourceGroupName: resourceInstances[0].resourceGroupName,
        });
      }

      // 3. Fetch per-instance billing records (primary cost source)
      const instanceUsageCacheKey = CacheKeyGenerator.forInstanceUsage(accountId, month as string);
      const instanceUsageRecords = await this.cacheManager.getOrSet(
        instanceUsageCacheKey,
        async () => {
          const usageClient = clientFactory.createUsageReportsClient();
          return await usageClient.getResourceUsage(accountId, month as string);
        },
        CacheTTL.USAGE,
      );

      // Build creator enrichment map for grouping billing records by creator
      const creatorEnrichmentMap = new Map<string, { createdBy?: string; creatorProfile?: any }>();
      for (const resource of resourceInstances) {
        const entry = {
          createdBy: resource.createdBy || (resource as any).created_by,
          creatorProfile: resource.creatorProfile,
        };
        creatorEnrichmentMap.set(resource.id, entry);
        if (resource.crn && resource.crn !== resource.id) {
          creatorEnrichmentMap.set(resource.crn, entry);
        }
      }

      const defaultRgForSummary = resourceGroups.find((rg: ResourceGroup) => rg.default === true || rg.name === 'Default');
      const costAllocation = this.buildCostAllocation(
        accountSummary.resources,
        instanceUsageRecords,
        creatorEnrichmentMap,
        defaultRgForSummary?.id || 'Default',
        defaultRgForSummary?.name || 'Default',
      );

      // 4. Return combined response
      res.json({
        accountId,
        month,
        // Usage/cost data (by service type, not per-instance)
        account_id: accountSummary.account_id,
        billing_country_code: accountSummary.billing_country_code,
        billing_currency_code: accountSummary.billing_currency_code,
        pricing_country: accountSummary.pricing_country,
        currency_code: accountSummary.currency_code,
        currency_rate: accountSummary.currency_rate,
        resources: accountSummary.resources, // Cost data by service type
        // Resource instances with creator profiles
        resourceInstances,
        resourceInstanceCount: resourceInstances.length,
        resourceGroups,
        costAllocation,
      });
    } catch (error) {
      logger.error('Failed to get enriched account summary', { error });
      next(error);
    }
  }

  /**
   * Enrich resources with creator profile information
   */
  private async enrichResourcesWithCreatorProfiles(
    accountId: string,
    resources: any[],
  ): Promise<any[]> {
    const userManagementClient = clientFactory.createUserManagementClient();
    
    // Extract unique IAM IDs from resource creators
    // Support both camelCase (createdBy) and snake_case (created_by) fields
    const iamIds = Array.from(
      new Set(
        resources
          .map((resource) => resource.createdBy || resource.created_by)
          .filter((createdBy): createdBy is string => Boolean(createdBy))
          .map((createdBy) => UserManagementClient.extractIamIdFromEmail(createdBy)),
      ),
    );

    if (iamIds.length === 0) {
      return resources;
    }

    // Fetch user profiles in batch
    const profiles = await userManagementClient.getUserProfiles(accountId, iamIds);

    // Attach profiles to resources
    return resources.map((resource) => {
      // Support both camelCase (createdBy) and snake_case (created_by) fields
      const createdBy = resource.createdBy || resource.created_by;
      if (!createdBy) {
        return resource;
      }

      const lookupIamId = UserManagementClient.extractIamIdFromEmail(createdBy);
      const profile = profiles.get(lookupIamId);

      if (!profile) {
        return resource;
      }

      return {
        ...resource,
        creatorProfile: {
          iamId: profile.iamId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      };
    });
  }

  private resolveResourceGroupName(
    resource: IBMResourceInstance & { resource_group_id?: string },
    resourceGroupNameById: Map<string, string>,
  ): string {
    const resourceGroupId = resource.resourceGroupId || resource.resource_group_id;
    if (!resourceGroupId) {
      return 'Unassigned';
    }

    return resourceGroupNameById.get(resourceGroupId) || resourceGroupId;
  }

  /**
   * Builds cost allocation from billing records (getResourceUsageAccount) as the primary source.
   * Groups by resource_group_id and creator from billing records + enrichment map.
   * Resource group costs are the SUM of billing record costs — accurate, no equal-distribution.
   */
  private buildCostAllocation(
    accountResources: AccountResource[],
    instanceUsageRecords: UsageReportsV4.InstanceUsage[],
    creatorEnrichmentMap: Map<string, { createdBy?: string; creatorProfile?: any }>,
    defaultRgId: string = 'Default',
    defaultRgName: string = 'Default',
  ): {
    totalAllocatableCost: number;
    unallocatedCost: number;
    creatorCosts: Array<{ creatorKey: string; cost: number; resourceCount: number }>;
    resourceGroupCosts: Array<{
      resourceGroupId: string;
      resourceGroupName: string;
      cost: number;
      resourceCount: number;
      resourceNames: string[];
    }>;
  } {
    const totalAllocatableCost = accountResources.reduce((s, r) => s + (r.billable_cost || 0), 0);

    if (instanceUsageRecords.length === 0 || totalAllocatableCost === 0) {
      return { totalAllocatableCost, unallocatedCost: totalAllocatableCost, creatorCosts: [], resourceGroupCosts: [] };
    }

    const getRawCost = (record: UsageReportsV4.InstanceUsage): number =>
      record.usage.filter(m => !m.non_chargeable).reduce((s, m) => s + (m.cost ?? 0), 0);

    const creatorMap = new Map<string, { cost: number; resourceCount: number }>();
    const resourceGroupMap = new Map<string, {
      resourceGroupId: string;
      resourceGroupName: string;
      cost: number;
      resourceCount: number;
      resourceNames: Set<string>;
    }>();

    for (const record of instanceUsageRecords) {
      const cost = getRawCost(record);
      const enrichment = creatorEnrichmentMap.get(record.resource_instance_id);
      const creatorKey = enrichment?.createdBy || 'Unknown';
      const rgId = record.resource_group_id || defaultRgId;
      const rgName = record.resource_group_name || (rgId === defaultRgId ? defaultRgName : rgId);
      const resourceName = record.resource_instance_name || record.resource_instance_id;

      const creatorEntry = creatorMap.get(creatorKey) || { cost: 0, resourceCount: 0 };
      creatorEntry.cost += cost;
      creatorEntry.resourceCount += 1;
      creatorMap.set(creatorKey, creatorEntry);

      const rgEntry = resourceGroupMap.get(rgId) || {
        resourceGroupId: rgId,
        resourceGroupName: rgName,
        cost: 0,
        resourceCount: 0,
        resourceNames: new Set<string>(),
      };
      rgEntry.cost += cost;
      rgEntry.resourceCount += 1;
      rgEntry.resourceNames.add(resourceName);
      resourceGroupMap.set(rgId, rgEntry);
    }

    const attributedTotal = Array.from(resourceGroupMap.values()).reduce((s, rg) => s + rg.cost, 0);
    const unallocatedCost = Math.max(totalAllocatableCost - attributedTotal, 0);

    return {
      totalAllocatableCost,
      unallocatedCost,
      creatorCosts: Array.from(creatorMap.entries()).map(([creatorKey, v]) => ({
        creatorKey,
        cost: v.cost,
        resourceCount: v.resourceCount,
      })),
      resourceGroupCosts: Array.from(resourceGroupMap.values()).map(entry => ({
        resourceGroupId: entry.resourceGroupId,
        resourceGroupName: entry.resourceGroupName,
        cost: entry.cost,
        resourceCount: entry.resourceCount,
        resourceNames: Array.from(entry.resourceNames).sort(),
      })),
    };
  }
  /**
   * GET /api/usage/hierarchical-cost-breakdown
   * Gets hierarchical cost breakdown: Resource Group → Creator → Type → Sub-Type → Resources
   * Uses the SAME data source and cost allocation logic as getAccountSummary
   */
  public async getHierarchicalCostBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId: queryAccountId, month } = req.query;

      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required',
        });
        return;
      }

      if (!month) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'month query parameter is required (format: YYYY-MM)',
        });
        return;
      }

      logger.info('Getting hierarchical cost breakdown', { accountId, month });

      // 1. Fetch account usage (costs by service type) - SAME AS getAccountSummary
      const usageCacheKey = CacheKeyGenerator.forUsage(accountId, month as string);
      const accountSummary = await this.cacheManager.getOrSet(
        usageCacheKey,
        async () => {
          const usageClient = clientFactory.createUsageReportsClient();
          return await usageClient.getAccountUsage(accountId, month as string);
        },
        CacheTTL.USAGE,
      );

      // 2. Fetch all resources with creator profiles - SAME AS getAccountSummary
      const resourceClient = clientFactory.createResourceControllerClient();
      const resourcesCacheKey = CacheKeyGenerator.forResources(accountId);
      const enrichedResources = await this.cacheManager.getOrSet(
        resourcesCacheKey,
        async () => {
          const collector = new ResourceCollectorService(resourceClient);
          const resources = await collector.collectResources(accountId);
          return await this.enrichResourcesWithCreatorProfiles(accountId, resources);
        },
        CacheTTL.RESOURCES,
      );

      // 3. Fetch resource groups for name mapping - SAME AS getAccountSummary
      const resourceGroupsCacheKey = `${resourcesCacheKey}:groups`;
      const resourceGroups = await this.cacheManager.getOrSet(
        resourceGroupsCacheKey,
        async () => await resourceClient.listResourceGroups(),
        CacheTTL.RESOURCES,
      );

      const resourceGroupNameById = new Map<string, string>(
        resourceGroups.map((group: ResourceGroup) => [group.id, group.name]),
      );

      // 4. Build creator enrichment map: resource_instance_id → creator info (from Resource Controller)
      const creatorEnrichmentMap = new Map<string, {
        createdBy?: string;
        creatorProfile?: { email?: string; iamId?: string; firstName?: string; lastName?: string };
        createdAt?: string;
        name?: string;
      }>();
      for (const resource of enrichedResources) {
        const entry = {
          createdBy: resource.createdBy || (resource as any).created_by,
          creatorProfile: resource.creatorProfile,
          createdAt: resource.createdAt,
          name: resource.name,
        };
        creatorEnrichmentMap.set(resource.id, entry);
        if (resource.crn && resource.crn !== resource.id) {
          creatorEnrichmentMap.set(resource.crn, entry);
        }
      }

      // 5. Fetch per-instance billing records — primary source for costs
      const instanceUsageCacheKey = CacheKeyGenerator.forInstanceUsage(accountId, month as string);
      const instanceUsageRecords = await this.cacheManager.getOrSet(
        instanceUsageCacheKey,
        async () => {
          const usageClient = clientFactory.createUsageReportsClient();
          return await usageClient.getResourceUsage(accountId, month as string);
        },
        CacheTTL.USAGE,
      );

      // 6. Find Default resource group (fallback for records with no resource_group_id)
      const defaultRg = resourceGroups.find((rg: ResourceGroup) => rg.default === true || rg.name === 'Default');
      const defaultRgId = defaultRg?.id || 'Default';
      const defaultRgName = defaultRg?.name || 'Default';

      // 7. Fetch IBM console-authoritative per-RG costs in parallel (one call per resource group)
      // getResourceGroupUsage() is what IBM console uses — gives exact matching per-RG numbers
      const rgUsageMap = new Map<string, number>();
      const usageClientForRg = clientFactory.createUsageReportsClient();
      await Promise.all(
        resourceGroups.map(async (rg: ResourceGroup) => {
          try {
            const rgCacheKey = CacheKeyGenerator.forResourceGroupUsage(accountId, rg.id, month as string);
            const rgUsage = await this.cacheManager.getOrSet(
              rgCacheKey,
              () => usageClientForRg.getResourceGroupUsage(accountId, rg.id, month as string),
              CacheTTL.USAGE,
            );
            const rgTotal = (rgUsage.resources || []).reduce((s: number, r: any) => s + (r.billable_cost || 0), 0);
            rgUsageMap.set(rg.id, rgTotal);
          } catch {
            // RG may have no usage for this month — skip, bottom-up cost will be used
          }
        }),
      );

      // 8. Build hierarchy from billing records (not Resource Controller).
      // This ensures ALL billed items appear — including platform/subscription items
      // that exist in billing but have no Resource Controller entry.
      const hierarchicalBreakdown = this.transformCostAllocationToHierarchy(
        instanceUsageRecords,
        creatorEnrichmentMap,
        resourceGroupNameById,
        defaultRgId,
        defaultRgName,
        rgUsageMap,
        accountSummary.currency_code || 'USD',
      );

      const authoritativeTotal = accountSummary.resources.reduce((s, r) => s + (r.billable_cost || 0), 0);
      const attributedTotal = rgUsageMap.size > 0
        ? Array.from(rgUsageMap.values()).reduce((s, v) => s + v, 0)
        : hierarchicalBreakdown.totalCost;
      const unattributedCost = Math.max(authoritativeTotal - attributedTotal, 0);

      // 7. Return response
      res.json({
        accountId,
        month,
        hierarchicalBreakdown: {
          ...hierarchicalBreakdown,
          authoritativeTotal,
          unattributedCost,
        },
      });
    } catch (error) {
      logger.error('Failed to get hierarchical cost breakdown', { error });
      next(error);
    }
  }

  /**
   * Builds hierarchical cost breakdown using IBM Cloud billing records as the primary source.
   * Billing records from getResourceUsageAccount() carry resource_group_id directly and capture
   * ALL billed items — including platform/subscription items without Resource Controller entries.
   * Creator info is enriched via creatorEnrichmentMap (Resource Controller join).
   *
   * Hierarchy: Resource Group → Creator → Service Type → Region → Individual Billing Record
   */
  private transformCostAllocationToHierarchy(
    usageRecords: UsageReportsV4.InstanceUsage[],
    creatorEnrichmentMap: Map<string, {
      createdBy?: string;
      creatorProfile?: { email?: string; iamId?: string; firstName?: string; lastName?: string };
      createdAt?: string;
      name?: string;
    }>,
    resourceGroupNameById: Map<string, string>,
    defaultRgId: string,
    defaultRgName: string,
    rgUsageMap: Map<string, number>,
    currency: string,
  ): HierarchicalCostBreakdown {
    const getRawCost = (record: UsageReportsV4.InstanceUsage): number =>
      record.usage.filter(m => !m.non_chargeable).reduce((s, m) => s + (m.cost ?? 0), 0);

    // Group billing records by resource_group_id — records with no RG go to Default
    const rgMap = new Map<string, { rgName: string; records: UsageReportsV4.InstanceUsage[] }>();
    for (const record of usageRecords) {
      const rgId = record.resource_group_id || defaultRgId;
      const rgName = record.resource_group_name || resourceGroupNameById.get(rgId) || (rgId === defaultRgId ? defaultRgName : rgId);
      const existing = rgMap.get(rgId) ?? { rgName, records: [] };
      existing.records.push(record);
      rgMap.set(rgId, existing);
    }

    const resourceGroups: ResourceGroupAggregation[] = Array.from(rgMap.entries()).map(([rgId, { rgName, records }]) => {
      // Group by creator (enriched from Resource Controller, fallback to 'Unknown')
      const creatorMap = new Map<string, UsageReportsV4.InstanceUsage[]>();
      for (const record of records) {
        const enrichment = creatorEnrichmentMap.get(record.resource_instance_id);
        const creatorKey = enrichment?.createdBy || 'Unknown';
        const existing = creatorMap.get(creatorKey) ?? [];
        creatorMap.set(creatorKey, [...existing, record]);
      }

      const creators: CreatorAggregation[] = Array.from(creatorMap.entries()).map(([creatorKey, creatorRecords]) => {
        // Resolve display email and type
        let creatorDisplayEmail: string | undefined;
        let creatorType: 'user' | 'service' | 'unknown' = 'unknown';

        if (creatorKey.startsWith('IBMid-')) {
          creatorType = 'user';
          const found = creatorRecords.find(r => creatorEnrichmentMap.get(r.resource_instance_id)?.creatorProfile?.email);
          creatorDisplayEmail = found ? creatorEnrichmentMap.get(found.resource_instance_id)?.creatorProfile?.email : undefined;
        } else if (creatorKey.startsWith('iam-ServiceId-')) {
          creatorType = 'service';
          const found = creatorRecords.find(r => creatorEnrichmentMap.get(r.resource_instance_id)?.creatorProfile?.email);
          creatorDisplayEmail = found
            ? creatorEnrichmentMap.get(found.resource_instance_id)?.creatorProfile?.email
            : 'unknown';
        } else if (creatorKey.includes('@')) {
          creatorType = 'user';
          creatorDisplayEmail = creatorKey;
        }

        // Group by service type — use human-readable resource_name, keyed by resource_id
        const typeMap = new Map<string, UsageReportsV4.InstanceUsage[]>();
        for (const record of creatorRecords) {
          const typeKey = record.resource_name || record.resource_id || 'unknown';
          const existing = typeMap.get(typeKey) ?? [];
          typeMap.set(typeKey, [...existing, record]);
        }

        const types: TypeAggregation[] = Array.from(typeMap.entries()).map(([type, typeRecords]) => {
          // Group by region (sub-type)
          const subTypeMap = new Map<string, UsageReportsV4.InstanceUsage[]>();
          for (const record of typeRecords) {
            const region = record.region || record.pricing_region || 'global';
            const existing = subTypeMap.get(region) ?? [];
            subTypeMap.set(region, [...existing, record]);
          }

          const subTypes: SubTypeAggregation[] = Array.from(subTypeMap.entries()).map(([subType, stRecords]) => {
            const resources: ResourceCostDetail[] = stRecords.map(record => {
              const enrichment = creatorEnrichmentMap.get(record.resource_instance_id);
              return {
                resourceId: record.resource_instance_id,
                resourceName: record.resource_instance_name || enrichment?.name || record.resource_instance_id,
                resourceType: type,
                resourceSubType: subType,
                cost: getRawCost(record),
                currency,
                creatorEmail: creatorKey,
                resourceGroupId: rgId,
                resourceGroupName: rgName,
                region: record.region,
                createdAt: enrichment?.createdAt || (record as any).created_at,
              };
            });

            const subTypeCost = resources.reduce((s, r) => s + r.cost, 0);
            return { subType, cost: subTypeCost, currency, resourceCount: stRecords.length, resources };
          });

          subTypes.sort((a, b) => b.cost - a.cost);
          const typeCost = subTypes.reduce((s, st) => s + st.cost, 0);
          return { type, cost: typeCost, currency, resourceCount: typeRecords.length, subTypes };
        });

        types.sort((a, b) => b.cost - a.cost);
        const creatorCost = types.reduce((s, t) => s + t.cost, 0);

        return {
          creatorEmail: creatorKey,
          creatorDisplayEmail,
          creatorType,
          cost: creatorCost,
          currency,
          resourceCount: creatorRecords.length,
          types,
        };
      });

      creators.sort((a, b) => b.cost - a.cost);
      const rgBottomUpCost = creators.reduce((s, c) => s + c.cost, 0);
      // Use IBM console-authoritative cost from getResourceGroupUsage() if available,
      // otherwise fall back to the bottom-up sum from getResourceUsageAccount() records
      const rgTotalCost = rgUsageMap.get(rgId) ?? rgBottomUpCost;

      return {
        resourceGroupId: rgId,
        resourceGroupName: rgName,
        cost: rgTotalCost,
        currency,
        resourceCount: records.length,
        creators,
      };
    });

    resourceGroups.sort((a, b) => b.cost - a.cost);
    const totalCost = resourceGroups.reduce((s, rg) => s + rg.cost, 0);

    return {
      resourceGroups,
      totalCost,
      currency,
      totalResourceCount: usageRecords.length,
      generatedAt: new Date(),
    };
  }
}

