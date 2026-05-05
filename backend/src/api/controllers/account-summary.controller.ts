import type { Request, Response, NextFunction } from 'express';
import { clientFactory } from '../../clients/client-factory';
import { ResourceCollectorService } from '../../services/resource-collector.service';
import { UserManagementClient } from '../../clients/user-management.client';
import type { AccountResource, ResourceGroup, ResourceInstance as IBMResourceInstance } from '../../types/ibm-cloud.types';
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
}

