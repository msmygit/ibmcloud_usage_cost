import type { Request, Response, NextFunction } from 'express';
import { clientFactory } from '../../clients/client-factory';
import { ResourceCollectorService } from '../../services/resource-collector.service';
import { UserManagementClient } from '../../clients/user-management.client';
import type { AccountResource, ResourceGroup, ResourceInstance as IBMResourceInstance, UsageResourceRecord } from '../../types/ibm-cloud.types';
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

      const costAllocation = this.buildCostAllocation(accountSummary.resources, resourceInstances);

      // 3. Return combined response
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

  private buildCostAllocation(
    usageResources: AccountResource[],
    resourceInstances: Array<IBMResourceInstance & { resource_group_id?: string; resourceGroupName?: string }>,
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

    const totalResourceInstances = resourceInstances.length;

    if (totalResourceInstances === 0 || totalAllocatableCost === 0) {
      return {
        totalAllocatableCost,
        unallocatedCost: totalAllocatableCost,
        creatorCosts: [],
        resourceGroupCosts: [],
      };
    }

    const perResourceCost = totalAllocatableCost / totalResourceInstances;
    const creatorMap = new Map<string, { cost: number; resourceCount: number }>();
    const resourceGroupMap = new Map<
      string,
      { resourceGroupId: string; resourceGroupName: string; cost: number; resourceCount: number; resourceNames: Set<string> }
    >();

    for (const resource of resourceInstances) {
      const creatorKey = String(resource.createdBy || (resource as any).created_by || 'Unknown');
      const resourceGroupId = resource.resourceGroupId || resource.resource_group_id || 'unknown';
      const resourceGroupName = resource.resourceGroupName || resourceGroupId;
      const resourceName = resource.name || resource.guid || resource.id;

      const creatorEntry = creatorMap.get(creatorKey) || { cost: 0, resourceCount: 0 };
      creatorEntry.cost += perResourceCost;
      creatorEntry.resourceCount += 1;
      creatorMap.set(creatorKey, creatorEntry);

      const resourceGroupEntry = resourceGroupMap.get(resourceGroupId) || {
        resourceGroupId,
        resourceGroupName,
        cost: 0,
        resourceCount: 0,
        resourceNames: new Set<string>(),
      };
      resourceGroupEntry.cost += perResourceCost;
      resourceGroupEntry.resourceCount += 1;
      resourceGroupEntry.resourceNames.add(resourceName);
      resourceGroupMap.set(resourceGroupId, resourceGroupEntry);
    }

    const allocatedCost = perResourceCost * totalResourceInstances;

    return {
      totalAllocatableCost,
      unallocatedCost: Math.max(totalAllocatableCost - allocatedCost, 0),
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

      // 5. Build cost allocation using SAME method as getAccountSummary
      const costAllocation = this.buildCostAllocation(accountSummary.resources, resourceInstances);

      logger.info('Cost allocation for hierarchical breakdown', {
        totalAllocatableCost: costAllocation.totalAllocatableCost,
        resourceGroupCount: costAllocation.resourceGroupCosts.length,
        resourceInstanceCount: resourceInstances.length,
      });

      // 6. Build hierarchical breakdown with actual usage costs
      const hierarchicalBreakdown = this.transformCostAllocationToHierarchy(
        costAllocation,
        resourceInstances,
        accountSummary.currency_code || 'USD',
        accountSummary.resources, // Pass usage data for actual costs
      );

      // 7. Return response
      res.json({
        accountId,
        month,
        hierarchicalBreakdown,
      });
    } catch (error) {
      logger.error('Failed to get hierarchical cost breakdown', { error });
      next(error);
    }
  }

  /**
   * Transforms cost allocation data into hierarchical structure
   * Resource Group → Creator → Type → Sub-Type → Resources
   */
  private transformCostAllocationToHierarchy(
    costAllocation: {
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
    },
    resourceInstances: Array<IBMResourceInstance & { resource_group_id?: string; resourceGroupName?: string }>,
    currency: string,
    usageResources?: Array<any>, // Usage data with actual costs per resource
  ): HierarchicalCostBreakdown {
    // Build a map of actual resource costs from usage data
    // NOTE: usageResources contains service-level costs, NOT per-resource costs
    // We need to distribute costs across resources within each service type
    const resourceCostMap = new Map<string, number>();
    
    // Build hierarchical structure from resource group costs
    const resourceGroups: ResourceGroupAggregation[] = costAllocation.resourceGroupCosts.map((rgCost) => {
      // Filter resources for this resource group
      const rgResources = resourceInstances.filter((r) => {
        const resourceGroupId = r.resourceGroupId || r.resource_group_id || 'unknown';
        return resourceGroupId === rgCost.resourceGroupId;
      });

      // Calculate per-resource cost for THIS resource group
      // This is the ONLY way to get individual resource costs since IBM Cloud API
      // only provides service-level aggregated costs, not per-resource costs
      const perResourceCost = rgResources.length > 0 ? rgCost.cost / rgResources.length : 0;

      // Group by creator
      const creatorMap = new Map<string, typeof rgResources>();
      for (const resource of rgResources) {
        const creatorKey = String(resource.createdBy || (resource as any).created_by || 'Unknown');
        const existing = creatorMap.get(creatorKey) || [];
        creatorMap.set(creatorKey, [...existing, resource]);
      }

      // Build creator aggregations
      const creators: CreatorAggregation[] = Array.from(creatorMap.entries()).map(([creatorKey, creatorResources]) => {
        // Calculate creator cost by summing per-resource costs
        // Each resource gets an equal share of the resource group's total cost
        const creatorCost = creatorResources.length * perResourceCost;

        // Determine creator type and display email for IBMid/ServiceId
        let creatorDisplayEmail: string | undefined;
        let creatorType: 'user' | 'service' | 'unknown' = 'unknown';
        
        if (creatorKey.startsWith('IBMid-')) {
          creatorType = 'user';
          // PRIORITY 1: Check creatorProfile.email (enriched from User Management API)
          const profileResource = creatorResources.find(r => r.creatorProfile?.email);
          if (profileResource?.creatorProfile?.email) {
            creatorDisplayEmail = profileResource.creatorProfile.email;
          } else {
            // PRIORITY 2: Check if createdBy field contains an email
            const emailResource = creatorResources.find(r => {
              const email = r.createdBy || (r as any).created_by;
              return email && email.includes('@');
            });
            creatorDisplayEmail = emailResource?.createdBy || (emailResource as any)?.created_by;
          }
        } else if (creatorKey.startsWith('iam-ServiceId-')) {
          creatorType = 'service';
          // PRIORITY 1: Check creatorProfile.email (enriched from User Management API)
          const profileResource = creatorResources.find(r => r.creatorProfile?.email);
          if (profileResource?.creatorProfile?.email) {
            creatorDisplayEmail = profileResource.creatorProfile.email;
          } else {
            // PRIORITY 2: Check if createdBy field contains an email
            const emailResource = creatorResources.find(r => {
              const email = r.createdBy || (r as any).created_by;
              return email && email.includes('@');
            });
            creatorDisplayEmail = emailResource?.createdBy || (emailResource as any)?.created_by || 'unknown';
          }
        } else if (creatorKey.includes('@')) {
          // Already an email
          creatorType = 'user';
          creatorDisplayEmail = creatorKey;
        }

        // Group by type
        const typeMap = new Map<string, typeof creatorResources>();
        for (const resource of creatorResources) {
          const type = this.extractServiceTypeFromResource(resource);
          const existing = typeMap.get(type) || [];
          typeMap.set(type, [...existing, resource]);
        }

        // Build type aggregations
        const types: TypeAggregation[] = Array.from(typeMap.entries()).map(([type, typeResources]) => {
          // Calculate type cost by summing per-resource costs
          const typeCost = typeResources.length * perResourceCost;

          // Group by sub-type (extract region from CRN or use regionId)
          const subTypeMap = new Map<string, typeof typeResources>();
          for (const resource of typeResources) {
            // Extract region from CRN (format: crn:v1:bluemix:public:service:region:...)
            let region = resource.regionId || 'default';
            if (!resource.regionId && resource.crn) {
              const crnParts = resource.crn.split(':');
              if (crnParts.length >= 6 && crnParts[5]) {
                region = crnParts[5];
              }
            }
            // If still no region, try to extract from resource name patterns
            if (region === 'default' && resource.name) {
              const regionMatch = resource.name.match(/\b(us-south|us-east|eu-gb|eu-de|jp-tok|au-syd|br-sao|ca-tor|jp-osa|eu-es)\b/i);
              if (regionMatch && regionMatch[1]) {
                region = regionMatch[1].toLowerCase();
              }
            }
            const existing = subTypeMap.get(region) || [];
            subTypeMap.set(region, [...existing, resource]);
          }

          // Build sub-type aggregations
          const subTypes: SubTypeAggregation[] = Array.from(subTypeMap.entries()).map(([subType, subTypeResources]) => {
            // Calculate sub-type cost by summing per-resource costs
            const subTypeCost = subTypeResources.length * perResourceCost;

            // Build resource cost details - each resource gets equal share
            const resources: ResourceCostDetail[] = subTypeResources.map((resource) => {
              return {
                resourceId: resource.id,
                resourceName: resource.name,
                resourceType: type,
                resourceSubType: subType,
                cost: perResourceCost, // Each resource gets equal share of resource group cost
                currency,
                creatorEmail: resource.createdBy || (resource as any).created_by || 'Unknown',
                resourceGroupId: rgCost.resourceGroupId,
                resourceGroupName: rgCost.resourceGroupName,
                region: resource.regionId,
                createdAt: resource.createdAt,
              };
            });

            return {
              subType,
              cost: subTypeCost,
              currency,
              resourceCount: subTypeResources.length,
              resources,
            };
          });

          // Sort sub-types by cost descending
          subTypes.sort((a, b) => b.cost - a.cost);

          return {
            type,
            cost: typeCost,
            currency,
            resourceCount: typeResources.length,
            subTypes,
          };
        });

        // Sort types by cost descending
        types.sort((a, b) => b.cost - a.cost);

        return {
          creatorEmail: creatorKey,
          creatorDisplayEmail, // Email to display as sub-label for IBMid/ServiceId
          creatorType, // 'user', 'service', or 'unknown'
          cost: creatorCost,
          currency,
          resourceCount: creatorResources.length,
          types,
        };
      });

      // Sort creators by cost descending
      creators.sort((a, b) => b.cost - a.cost);

      return {
        resourceGroupId: rgCost.resourceGroupId,
        resourceGroupName: rgCost.resourceGroupName,
        cost: rgCost.cost,
        currency,
        resourceCount: rgCost.resourceCount,
        creators,
      };
    });

    // Sort resource groups by cost descending
    resourceGroups.sort((a, b) => b.cost - a.cost);

    return {
      resourceGroups,
      totalCost: costAllocation.totalAllocatableCost,
      currency,
      totalResourceCount: resourceInstances.length,
      generatedAt: new Date(),
    };
  }
}

