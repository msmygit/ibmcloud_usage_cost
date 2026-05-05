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
  private async enrichResourcesWithCreatorProfiles(accountId: string, resources: any[]): Promise<any[]> {
    const userManagementClient = this.clientFactory.createUserManagementClient();
    const iamIds = Array.from(
      new Set(
        resources
          .map((resource) => resource.createdBy)
          .filter((createdBy): createdBy is string => Boolean(createdBy))
          .map((createdBy) => UserManagementClient.extractIamIdFromEmail(createdBy)),
      ),
    );

    if (iamIds.length === 0) {
      return resources;
    }

    const profiles = await userManagementClient.getUserProfiles(accountId, iamIds);

    return resources.map((resource) => {
      const createdBy = resource.createdBy;
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