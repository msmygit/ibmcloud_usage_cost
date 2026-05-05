import type { ResourceControllerClient } from '../clients/resource-controller.client.ts';
import type { ResourceInstance } from '../types/ibm-cloud.types';
import type { ResourceQueryOptions } from '../types/resource.types';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

/**
 * Service for collecting resource data from IBM Cloud Resource Controller
 */
export class ResourceCollectorService {
  public constructor(private readonly resourceClient: ResourceControllerClient) {}

  /**
   * Collects all resources for an account with automatic pagination
   * @param accountId - IBM Cloud account ID
   * @param options - Query options including progress callback
   * @returns Array of resource instances
   */
  public async collectResources(
    accountId: string,
    options: ResourceQueryOptions = {},
  ): Promise<ResourceInstance[]> {
    logger.info('Starting resource collection', { accountId, options });

    try {
      const resources = await withRetry(
        async () => {
          return await this.resourceClient.getAllResourceInstances(accountId, {
            ...options,
            onProgress: (count) => {
              logger.debug('Resource collection progress', { count });
              if (options.onProgress) {
                options.onProgress(count);
              }
            },
          });
        },
        {
          attempts: 3,
          minTimeoutMs: 1000,
          maxTimeoutMs: 10000,
          factor: 2,
        },
        {
          operation: 'collectResources',
          service: 'ResourceCollector',
        },
      );

      logger.info('Resource collection completed', {
        accountId,
        resourceCount: resources.length,
      });

      return resources;
    } catch (error) {
      logger.error('Failed to collect resources', { accountId, error });
      throw error;
    }
  }

  /**
   * Collects resources for multiple resource groups concurrently
   * @param accountId - IBM Cloud account ID
   * @param resourceGroupIds - Array of resource group IDs
   * @param options - Query options
   * @returns Array of all resources across resource groups
   */
  public async collectResourcesByGroups(
    accountId: string,
    resourceGroupIds: string[],
    options: ResourceQueryOptions = {},
  ): Promise<ResourceInstance[]> {
    logger.info('Starting resource collection by groups', {
      accountId,
      groupCount: resourceGroupIds.length,
    });

    try {
      // Collect resources from all groups concurrently
      const resourcePromises = resourceGroupIds.map((resourceGroupId) =>
        this.collectResources(accountId, {
          ...options,
          resourceGroupId,
        }),
      );

      const resourceArrays = await Promise.all(resourcePromises);
      const allResources = resourceArrays.flat();

      logger.info('Resource collection by groups completed', {
        accountId,
        groupCount: resourceGroupIds.length,
        totalResources: allResources.length,
      });

      return allResources;
    } catch (error) {
      logger.error('Failed to collect resources by groups', { accountId, error });
      throw error;
    }
  }

  /**
   * Extracts resource metadata for analysis
   * @param resource - Resource instance
   * @returns Extracted metadata
   */
  public extractResourceMetadata(resource: ResourceInstance): {
    id: string;
    name: string;
    type: string;
    region?: string;
    createdAt?: string;
    createdBy?: string;
  } {
    return {
      id: resource.id,
      name: resource.name,
      type: resource.type || 'unknown',
      region: resource.regionId,
      createdAt: resource.createdAt,
      createdBy: resource.createdBy,
    };
  }

  /**
   * Filters resources by creation date range
   * @param resources - Array of resources
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @returns Filtered resources
   */
  public filterByDateRange(
    resources: ResourceInstance[],
    startDate: string,
    endDate: string,
  ): ResourceInstance[] {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return resources.filter((resource) => {
      if (!resource.createdAt) {
        return false;
      }

      const createdAt = new Date(resource.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }

  /**
   * Groups resources by creator email
   * @param resources - Array of resources
   * @returns Map of creator email to resources
   */
  public groupByCreator(resources: ResourceInstance[]): Map<string, ResourceInstance[]> {
    const grouped = new Map<string, ResourceInstance[]>();

    for (const resource of resources) {
      const creator = resource.createdBy || 'unknown';
      const existing = grouped.get(creator) || [];
      grouped.set(creator, [...existing, resource]);
    }

    return grouped;
  }

  /**
   * Groups resources by type
   * @param resources - Array of resources
   * @returns Map of resource type to resources
   */
  public groupByType(resources: ResourceInstance[]): Map<string, ResourceInstance[]> {
    const grouped = new Map<string, ResourceInstance[]>();

    for (const resource of resources) {
      const type = resource.type || 'unknown';
      const existing = grouped.get(type) || [];
      grouped.set(type, [...existing, resource]);
    }

    return grouped;
  }
}

// Made with Bob