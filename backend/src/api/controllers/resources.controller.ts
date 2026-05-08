import type { Request, Response, NextFunction } from 'express';
import { ClientFactory } from '../../clients/client-factory';
import { ResourceCollectorService } from '../../services/resource-collector.service';
import { CacheManager, CacheTTL } from '../../cache/cache-manager';
import { CacheKeyGenerator } from '../../cache/cache-keys';
import { UserManagementClient } from '../../clients/user-management.client';
import { logger } from '../../utils/logger';
import { ibmCloudConfig } from '../../config/ibm-cloud.config';

/**
 * Controller for resource-related endpoints
 */
export class ResourcesController {
  private readonly clientFactory: ClientFactory;
  private readonly cacheManager: CacheManager;

  public constructor(clientFactory: ClientFactory, cacheManager: CacheManager) {
    this.clientFactory = clientFactory;
    this.cacheManager = cacheManager;
  }

  /**
   * GET /api/resources
   * Lists all resources for an account
   */
  public async listResources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId: queryAccountId, resourceGroupId } = req.query;

      // Use accountId from query or fall back to config
      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required or must be configured in environment',
        });
        return;
      }

      logger.info('Listing resources', {
        accountId,
        accountIdSource: queryAccountId ? 'query' : 'config',
        resourceGroupId,
      });

      // Generate cache key
      const cacheKey = CacheKeyGenerator.forResources(
        accountId,
        resourceGroupId as string | undefined,
      );

      // Try to get from cache or fetch
      const resources = await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          const resourceClient = this.clientFactory.createResourceControllerClient();
          const collector = new ResourceCollectorService(resourceClient);

          const collectedResources = await collector.collectResources(accountId, {
            resourceGroupId: resourceGroupId as string | undefined,
          });

          return await this.enrichResourcesWithCreatorProfiles(accountId, collectedResources);
        },
        CacheTTL.RESOURCES,
      );

      res.json({
        accountId,
        resourceGroupId: resourceGroupId || null,
        count: resources.length,
        resources,
        cached: true,
      });
    } catch (error) {
      logger.error('Failed to list resources', { error });
      next(error);
    }
  }

  /**
   * GET /api/resources/:resourceId
   * Gets details for a specific resource
   */
  public async getResource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceId } = req.params;
      const { accountId: queryAccountId } = req.query;

      // Use accountId from query or fall back to config
      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required or must be configured in environment',
        });
        return;
      }

      logger.info('Getting resource', {
        resourceId,
        accountId,
        accountIdSource: queryAccountId ? 'query' : 'config',
      });

      // Get all resources (cached)
      const cacheKey = CacheKeyGenerator.forResources(accountId);
      const resources = await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          const resourceClient = this.clientFactory.createResourceControllerClient();
          const collector = new ResourceCollectorService(resourceClient);
          const collectedResources = await collector.collectResources(accountId);
          return await this.enrichResourcesWithCreatorProfiles(accountId, collectedResources);
        },
        CacheTTL.RESOURCES,
      );

      // Find the specific resource
      const resource = resources.find((r) => r.id === resourceId || r.guid === resourceId);

      if (!resource) {
        res.status(404).json({
          error: 'Not Found',
          message: `Resource ${resourceId} not found`,
        });
        return;
      }

      res.json({
        resource,
      });
    } catch (error) {
      logger.error('Failed to get resource', { error });
      next(error);
    }
  }

  /**
   * GET /api/resources/by-creator
   * Lists all active resources grouped by creator
   */
  public async listResourcesByCreator(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId: queryAccountId, state } = req.query;

      // Use accountId from query or fall back to config
      const accountId = (queryAccountId as string | undefined) || ibmCloudConfig.accountId;

      if (!accountId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'accountId query parameter is required or must be configured in environment',
        });
        return;
      }

      const filterState = (state as string | undefined) || 'active';

      logger.info('Listing resources by creator', {
        accountId,
        accountIdSource: queryAccountId ? 'query' : 'config',
        filterState,
      });

      // Generate cache key
      const cacheKey = CacheKeyGenerator.forResources(accountId);

      // Get all resources (cached)
      const allResources = await this.cacheManager.getOrSet(
        cacheKey,
        async () => {
          const resourceClient = this.clientFactory.createResourceControllerClient();
          const collector = new ResourceCollectorService(resourceClient);
          const collectedResources = await collector.collectResources(accountId);
          return await this.enrichResourcesWithCreatorProfiles(accountId, collectedResources);
        },
        CacheTTL.RESOURCES,
      );

      // Filter by state if specified
      const filteredResources = filterState
        ? allResources.filter((r) => r.state?.toLowerCase() === filterState.toLowerCase())
        : allResources;

      // Group by creator using email from profile if available, otherwise use createdBy/created_by
      const groupedByCreator = new Map<string, typeof filteredResources>();
      
      for (const resource of filteredResources) {
        const resourceAny = resource as any;
        // Prefer email from creator profile, fall back to createdBy or created_by field
        const creatorKey = resource.creatorProfile?.email ||
                          resource.creatorProfile?.iamId ||
                          resource.createdBy ||
                          resourceAny.created_by ||
                          'Unknown';
        
        const existing = groupedByCreator.get(creatorKey) || [];
        groupedByCreator.set(creatorKey, [...existing, resource]);
      }

      // Transform to array format with creator details
      const creatorGroups = Array.from(groupedByCreator.entries()).map(([creatorKey, resources]) => {
        const firstResource = resources[0];
        const profile = firstResource?.creatorProfile;

        return {
          creatorKey,
          creatorProfile: profile
            ? {
                iamId: profile.iamId,
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
              }
            : null,
          resourceCount: resources.length,
          resources: resources.map((r) => ({
            id: r.id,
            guid: r.guid,
            name: r.name,
            crn: r.crn,
            state: r.state,
            regionId: r.regionId,
            resourceGroupId: r.resourceGroupId,
            resourcePlanId: r.resourcePlanId,
            targetCrn: r.targetCrn,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            createdBy: r.createdBy,
            tags: r.tags,
            extensions: r.extensions,
            creatorProfile: r.creatorProfile,
            resourceId: r.resourceId, // The actual resource type (e.g., "is.floating-ip")
          })),
        };
      });

      // Sort by resource count descending
      creatorGroups.sort((a, b) => b.resourceCount - a.resourceCount);

      res.json({
        accountId,
        state: filterState,
        totalResources: filteredResources.length,
        creatorCount: creatorGroups.length,
        creatorGroups,
      });
    } catch (error) {
      logger.error('Failed to list resources by creator', { error });
      next(error);
    }
  }

  /**
   * POST /api/resources/details
   * Gets detailed information for multiple resources
   * Body: { resourceIds: string[] }
   */
  public async getResourceDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resourceIds } = req.body;

      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'resourceIds array is required',
        });
        return;
      }

      logger.info('Fetching details for resources', { count: resourceIds.length });

      const resourceClient = this.clientFactory.createResourceControllerClient();
      
      // Fetch details for all resources in parallel
      const detailsPromises = resourceIds.map(async (resourceId) => {
        try {
          const details = await resourceClient.getResourceInstance(resourceId);
          return { resourceId, details, error: null };
        } catch (error) {
          logger.error('Failed to fetch resource details', { resourceId, error });
          return { resourceId, details: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      const results = await Promise.all(detailsPromises);

      res.json({
        results,
        successCount: results.filter(r => r.details !== null).length,
        errorCount: results.filter(r => r.error !== null).length,
      });
    } catch (error) {
      logger.error('Failed to get resource details', { error });
      next(error);
    }
  }

  private async enrichResourcesWithCreatorProfiles(accountId: string, resources: any[]): Promise<any[]> {
    const userManagementClient = this.clientFactory.createUserManagementClient();
    // IBM Cloud returns created_by (snake_case), but TypeScript types use createdBy (camelCase)
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

    const profiles = await userManagementClient.getUserProfiles(accountId, iamIds);

    return resources.map((resource) => {
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
}

// Made with Bob