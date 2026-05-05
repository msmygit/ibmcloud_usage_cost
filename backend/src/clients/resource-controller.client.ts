import ResourceControllerV2 from '@ibm-cloud/platform-services/resource-controller/v2.js';
import ResourceManagerV2 from '@ibm-cloud/platform-services/resource-manager/v2.js';

import type { ResourceInstancesList, ResourceGroup, ResourceGroupsList } from '../types/ibm-cloud.types';
import type { ResourceQueryOptions } from '../types/resource.types';
import { logger } from '../utils/logger';

export class ResourceControllerClient {
  public constructor(
    private readonly client: ResourceControllerV2,
    private readonly resourceManager: ResourceManagerV2
  ) {}

  /**
   * Lists all resource groups accessible with the current API key.
   */
  public async listResourceGroups(): Promise<ResourceGroup[]> {
    try {
      logger.info('Fetching resource groups from IBM Cloud');
      
      const response = await this.resourceManager.listResourceGroups({});
      const result = response.result as ResourceGroupsList;
      const resourceGroups = result.resources || [];
      
      logger.info(`Fetched ${resourceGroups.length} resource groups`);
      
      return resourceGroups;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name
      }, 'Error fetching resource groups');
      throw error;
    }
  }

  /**
   * Lists all resource instances with automatic pagination support using ResourceInstancesPager.
   * Note: accountId is kept as parameter for API consistency but not passed to IBM Cloud SDK.
   * The account is determined by the API key used for authentication.
   */
  public async getAllResourceInstances(
    accountId: string,
    options: ResourceQueryOptions = {},
  ): Promise<ResourceInstancesList['resources']> {
    try {
      logger.info('Fetching resource instances using pager', {
        resourceGroupId: options.resourceGroupId,
        limit: options.limit ?? 100,
      });

      const params: any = {
        limit: options.limit ?? 100,
      };

      if (options.resourceGroupId) {
        params.resourceGroupId = options.resourceGroupId;
      }

      // Use ResourceInstancesPager for efficient pagination
      const pager = new (this.client.constructor as any).ResourceInstancesPager(
        this.client,
        params
      );

      const allInstances: ResourceInstancesList['resources'] = [];
      
      while (pager.hasNext()) {
        const nextPage = await pager.getNext();
        if (nextPage && nextPage.length > 0) {
          allInstances.push(...nextPage);
          
          if (options.onProgress) {
            options.onProgress(allInstances.length);
          }
        }
      }

      // Log first resource for debugging
      if (allInstances.length > 0) {
        console.log('=== FIRST RESOURCE INSTANCE SAMPLE ===');
        console.log(JSON.stringify(allInstances[0], null, 2));
        console.log('=== END SAMPLE ===');
      }

      logger.info(`Fetched ${allInstances.length} resource instances`);
      return allInstances;
    } catch (error) {
      logger.error('Error fetching resource instances with pager', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public extractStartToken(nextUrl?: string): string | null {
    if (!nextUrl) {
      return null;
    }

    try {
      // IBM Cloud returns relative URLs, need to add a base URL for parsing
      const parsedUrl = new URL(nextUrl, 'https://resource-controller.cloud.ibm.com');
      return parsedUrl.searchParams.get('start');
    } catch (error) {
      logger.error('Failed to parse next_url', { nextUrl, error });
      return null;
    }
  }
}

// Made with Bob
