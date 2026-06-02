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

      // 3. Fetch per-instance usage to build accurate cost map
      const instanceUsageCacheKey = CacheKeyGenerator.forInstanceUsage(accountId, month as string);
      const instanceUsageRecords = await this.cacheManager.getOrSet(
        instanceUsageCacheKey,
        async () => {
          const usageClient = clientFactory.createUsageReportsClient();
          return await usageClient.getResourceUsage(accountId, month as string);
        },
        CacheTTL.USAGE,
      );

      const { instanceCostMap, unattributedCost } = this.buildInstanceCostMap(
        accountSummary.resources,
        instanceUsageRecords,
      );

      const costAllocation = this.buildCostAllocation(
        accountSummary.resources,
        resourceInstances,
        instanceCostMap,
        unattributedCost,
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
   * Builds a per-instance cost map using proportional scaling.
   * Uses getAccountUsage() totals as the authoritative cost per service type,
   * then distributes each service's total proportionally across its instances
   * based on their relative metric costs from getResourceUsageAccount().
   * This ensures the sum of instance costs always matches the IBM Cloud billing total.
   */
  private buildInstanceCostMap(
    accountResources: AccountResource[],
    instanceUsageRecords: UsageReportsV4.InstanceUsage[],
  ): { instanceCostMap: Map<string, number>; unattributedCost: number } {
    // Authoritative service-level totals: resource_id → billable_cost
    const serviceTotalMap = new Map<string, number>();
    for (const svc of accountResources) {
      serviceTotalMap.set(svc.resource_id, (svc.billable_cost || 0));
    }

    // Group instance records by service type (resource_id)
    const instancesByService = new Map<string, UsageReportsV4.InstanceUsage[]>();
    for (const inst of instanceUsageRecords) {
      if (!inst.resource_id) continue;
      const existing = instancesByService.get(inst.resource_id) ?? [];
      instancesByService.set(inst.resource_id, [...existing, inst]);
    }

    // Raw cost = sum of non-chargeable-filtered metric costs (used as proportional weight only)
    const getRawCost = (inst: UsageReportsV4.InstanceUsage): number =>
      inst.usage.filter(m => !m.non_chargeable).reduce((s, m) => s + (m.cost ?? 0), 0);

    // Scale each instance so its service group sums to the authoritative service total
    const instanceCostMap = new Map<string, number>();
    for (const [resourceId, instances] of instancesByService) {
      const serviceTotal = serviceTotalMap.get(resourceId) ?? 0;
      const rawTotal = instances.reduce((s, inst) => s + getRawCost(inst), 0);

      for (const inst of instances) {
        const rawCost = getRawCost(inst);
        const scaledCost = rawTotal > 0
          ? (rawCost / rawTotal) * serviceTotal   // proportional share
          : serviceTotal / instances.length;       // equal fallback when all raw costs are 0
        instanceCostMap.set(inst.resource_instance_id, scaledCost);
      }
    }

    // Sum costs for services that have NO matching instances (subscription/platform costs)
    let unattributedCost = 0;
    for (const [resourceId, serviceTotal] of serviceTotalMap) {
      if (!instancesByService.has(resourceId) && serviceTotal > 0) {
        unattributedCost += serviceTotal;
      }
    }

    logger.info('Instance cost map built', {
      serviceCount: serviceTotalMap.size,
      instanceRecordCount: instanceUsageRecords.length,
      mappedInstanceCount: instanceCostMap.size,
      unattributedCost,
    });

    return { instanceCostMap, unattributedCost };
  }

  private buildCostAllocation(
    usageResources: AccountResource[],
    resourceInstances: Array<IBMResourceInstance & { resource_group_id?: string; resourceGroupName?: string }>,
    instanceCostMap: Map<string, number>,
    unattributedCost: number,
  ): {
    totalAllocatableCost: number;
    unallocatedCost: number;
    creatorCosts: Array<{
      creatorKey: string;
      cost: number;
      resourceCount: number;
    }>;
    resourceGroupCosts: Array<{
      resourceGroupId: string;
      resourceGroupName: string;
      cost: number;
      resourceCount: number;
      resourceNames: string[];
    }>;
  } {
    const totalAllocatableCost = usageResources.reduce(
      (sum, resource) => sum + (resource.billable_cost || 0),
      0,
    );

    if (resourceInstances.length === 0 || totalAllocatableCost === 0) {
      return {
        totalAllocatableCost,
        unallocatedCost: totalAllocatableCost,
        creatorCosts: [],
        resourceGroupCosts: [],
      };
    }

    const creatorMap = new Map<string, { cost: number; resourceCount: number }>();
    const resourceGroupMap = new Map<
      string,
      { resourceGroupId: string; resourceGroupName: string; cost: number; resourceCount: number; resourceNames: Set<string> }
    >();

    for (const resource of resourceInstances) {
      // Use actual proportionally-scaled cost from the instance cost map
      const resourceCost = instanceCostMap.get(resource.id)
        ?? instanceCostMap.get(resource.crn)
        ?? 0;

      const creatorKey = String(resource.createdBy || (resource as any).created_by || 'Unknown');
      const resourceGroupId = resource.resourceGroupId || resource.resource_group_id || 'unknown';
      const resourceGroupName = resource.resourceGroupName || resourceGroupId;
      const resourceName = resource.name || resource.guid || resource.id;

      const creatorEntry = creatorMap.get(creatorKey) || { cost: 0, resourceCount: 0 };
      creatorEntry.cost += resourceCost;
      creatorEntry.resourceCount += 1;
      creatorMap.set(creatorKey, creatorEntry);

      const resourceGroupEntry = resourceGroupMap.get(resourceGroupId) || {
        resourceGroupId,
        resourceGroupName,
        cost: 0,
        resourceCount: 0,
        resourceNames: new Set<string>(),
      };
      resourceGroupEntry.cost += resourceCost;
      resourceGroupEntry.resourceCount += 1;
      resourceGroupEntry.resourceNames.add(resourceName);
      resourceGroupMap.set(resourceGroupId, resourceGroupEntry);
    }

    return {
      totalAllocatableCost,
      unallocatedCost: unattributedCost,
      creatorCosts: Array.from(creatorMap.entries()).map(([creatorKey, value]) => ({
        creatorKey,
        cost: value.cost,
        resourceCount: value.resourceCount,
      })),
      resourceGroupCosts: Array.from(resourceGroupMap.values()).map((entry) => ({
        resourceGroupId: entry.resourceGroupId,
        resourceGroupName: entry.resourceGroupName,
        cost: entry.cost,
        resourceCount: entry.resourceCount,
        resourceNames: Array.from(entry.resourceNames).sort(),
      })),
    };
  }
  /**
   * Extracts service type from resource CRN or type field
   * @param resource - Resource instance
   * @returns Service type identifier
   */
  private extractServiceTypeFromResource(resource: any): string {
    // Priority 1: Extract from CRN (format: crn:v1:bluemix:public:SERVICE_TYPE:...)
    if (resource.crn) {
      const crnParts = resource.crn.split(':');
      if (crnParts.length >= 5) {
        return crnParts[4]; // Service type is the 5th component
      }
    }

    // Priority 2: Use resource type field
    if (resource.type) {
      return resource.type;
    }

    // Priority 3: Try to extract from resource ID
    if (resource.id && resource.id.includes(':')) {
      const idParts = resource.id.split(':');
      if (idParts.length >= 5) {
        return idParts[4];
      }
    }

    // Fallback: use 'unknown'
    return 'unknown';
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

      // 4. Add resource group names to enriched resources - SAME AS getAccountSummary
      const resourceInstances = enrichedResources.map((resource) => ({
        ...resource,
        resourceGroupName: this.resolveResourceGroupName(resource, resourceGroupNameById),
      }));

      // 5. Fetch per-instance usage and build proportionally-scaled cost map
      const instanceUsageCacheKey = CacheKeyGenerator.forInstanceUsage(accountId, month as string);
      const instanceUsageRecords = await this.cacheManager.getOrSet(
        instanceUsageCacheKey,
        async () => {
          const usageClient = clientFactory.createUsageReportsClient();
          return await usageClient.getResourceUsage(accountId, month as string);
        },
        CacheTTL.USAGE,
      );

      const { instanceCostMap, unattributedCost } = this.buildInstanceCostMap(
        accountSummary.resources,
        instanceUsageRecords,
      );

      // 6. Build hierarchical breakdown using proportionally-scaled per-instance costs
      const hierarchicalBreakdown = this.transformCostAllocationToHierarchy(
        resourceInstances,
        resourceGroupNameById,
        instanceCostMap,
        accountSummary.currency_code || 'USD',
      );

      const authoritativeTotal = accountSummary.resources.reduce((s, r) => s + (r.billable_cost || 0), 0);

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
   * Builds hierarchical cost breakdown using actual per-instance costs from IBM Cloud Usage Reports API.
   * Hierarchy: Resource Group → Creator → Type → Sub-Type → Individual Resources
   * Costs are looked up from instanceCostMap and aggregated bottom-up (resource → sub-type → type → creator → RG).
   */
  private transformCostAllocationToHierarchy(
    resourceInstances: Array<IBMResourceInstance & { resource_group_id?: string; resourceGroupName?: string }>,
    resourceGroupNameById: Map<string, string>,
    instanceCostMap: Map<string, number>,
    currency: string,
  ): HierarchicalCostBreakdown {
    // Group resources by resource group
    const rgMap = new Map<string, { rgName: string; resources: typeof resourceInstances }>();
    for (const resource of resourceInstances) {
      const rgId = resource.resourceGroupId || (resource as any).resource_group_id || 'unknown';
      const rgName = resource.resourceGroupName || resourceGroupNameById.get(rgId) || rgId;
      const existing = rgMap.get(rgId) ?? { rgName, resources: [] as typeof resourceInstances };
      existing.resources.push(resource);
      rgMap.set(rgId, existing);
    }

    const resourceGroups: ResourceGroupAggregation[] = Array.from(rgMap.entries()).map(([rgId, { rgName, resources: rgResources }]) => {
      // Group by creator within this resource group
      const creatorMap = new Map<string, typeof rgResources>();
      for (const resource of rgResources) {
        const creatorKey = String(resource.createdBy || (resource as any).created_by || 'Unknown');
        const existing = creatorMap.get(creatorKey) ?? [];
        creatorMap.set(creatorKey, [...existing, resource]);
      }

      const creators: CreatorAggregation[] = Array.from(creatorMap.entries()).map(([creatorKey, creatorResources]) => {
        // Resolve creator display email and type
        let creatorDisplayEmail: string | undefined;
        let creatorType: 'user' | 'service' | 'unknown' = 'unknown';

        if (creatorKey.startsWith('IBMid-')) {
          creatorType = 'user';
          const profileResource = creatorResources.find(r => r.creatorProfile?.email);
          if (profileResource?.creatorProfile?.email) {
            creatorDisplayEmail = profileResource.creatorProfile.email;
          } else {
            const emailResource = creatorResources.find(r => {
              const email = r.createdBy || (r as any).created_by;
              return email && email.includes('@');
            });
            creatorDisplayEmail = emailResource?.createdBy || (emailResource as any)?.created_by;
          }
        } else if (creatorKey.startsWith('iam-ServiceId-')) {
          creatorType = 'service';
          const profileResource = creatorResources.find(r => r.creatorProfile?.email);
          if (profileResource?.creatorProfile?.email) {
            creatorDisplayEmail = profileResource.creatorProfile.email;
          } else {
            const emailResource = creatorResources.find(r => {
              const email = r.createdBy || (r as any).created_by;
              return email && email.includes('@');
            });
            creatorDisplayEmail = emailResource?.createdBy || (emailResource as any)?.created_by || 'unknown';
          }
        } else if (creatorKey.includes('@')) {
          creatorType = 'user';
          creatorDisplayEmail = creatorKey;
        }

        // Group by service type
        const typeMap = new Map<string, typeof creatorResources>();
        for (const resource of creatorResources) {
          const type = this.extractServiceTypeFromResource(resource);
          const existing = typeMap.get(type) ?? [];
          typeMap.set(type, [...existing, resource]);
        }

        const types: TypeAggregation[] = Array.from(typeMap.entries()).map(([type, typeResources]) => {
          // Group by region/sub-type
          const subTypeMap = new Map<string, typeof typeResources>();
          for (const resource of typeResources) {
            let region = resource.regionId || 'default';
            if (!resource.regionId && resource.crn) {
              const crnParts = resource.crn.split(':');
              if (crnParts.length >= 6 && crnParts[5]) {
                region = crnParts[5];
              }
            }
            if (region === 'default' && resource.name) {
              const regionMatch = resource.name.match(/\b(us-south|us-east|eu-gb|eu-de|jp-tok|au-syd|br-sao|ca-tor|jp-osa|eu-es)\b/i);
              if (regionMatch?.[1]) {
                region = regionMatch[1].toLowerCase();
              }
            }
            const existing = subTypeMap.get(region) ?? [];
            subTypeMap.set(region, [...existing, resource]);
          }

          const subTypes: SubTypeAggregation[] = Array.from(subTypeMap.entries()).map(([subType, subTypeResources]) => {
            // Look up actual cost per resource from instanceCostMap using CRN (primary key)
            const resources: ResourceCostDetail[] = subTypeResources.map((resource) => {
              const actualCost = instanceCostMap.get(resource.id) ?? instanceCostMap.get(resource.crn) ?? 0;
              return {
                resourceId: resource.id,
                resourceName: resource.name,
                resourceType: type,
                resourceSubType: subType,
                cost: actualCost,
                currency,
                creatorEmail: resource.createdBy || (resource as any).created_by || 'Unknown',
                resourceGroupId: rgId,
                resourceGroupName: rgName,
                region: resource.regionId,
                createdAt: resource.createdAt,
              };
            });

            // Sub-type cost is the sum of its resources' actual costs
            const subTypeCost = resources.reduce((sum, r) => sum + r.cost, 0);

            return {
              subType,
              cost: subTypeCost,
              currency,
              resourceCount: subTypeResources.length,
              resources,
            };
          });

          subTypes.sort((a, b) => b.cost - a.cost);

          // Type cost is the sum of its sub-types' costs
          const typeCost = subTypes.reduce((sum, st) => sum + st.cost, 0);

          return {
            type,
            cost: typeCost,
            currency,
            resourceCount: typeResources.length,
            subTypes,
          };
        });

        types.sort((a, b) => b.cost - a.cost);

        // Creator cost is the sum of its types' costs
        const creatorCost = types.reduce((sum, t) => sum + t.cost, 0);

        return {
          creatorEmail: creatorKey,
          creatorDisplayEmail,
          creatorType,
          cost: creatorCost,
          currency,
          resourceCount: creatorResources.length,
          types,
        };
      });

      creators.sort((a, b) => b.cost - a.cost);

      // Resource group cost is the sum of its creators' costs
      const rgTotalCost = creators.reduce((sum, c) => sum + c.cost, 0);

      return {
        resourceGroupId: rgId,
        resourceGroupName: rgName,
        cost: rgTotalCost,
        currency,
        resourceCount: rgResources.length,
        creators,
      };
    });

    resourceGroups.sort((a, b) => b.cost - a.cost);

    // Total cost is the sum of all resource group costs (derived from actual per-instance data)
    const totalCost = resourceGroups.reduce((sum, rg) => sum + rg.cost, 0);

    return {
      resourceGroups,
      totalCost,
      currency,
      totalResourceCount: resourceInstances.length,
      generatedAt: new Date(),
    };
  }
}

