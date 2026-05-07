import type { ResourceControllerClient } from '../clients/resource-controller.client.ts';
import type { ResourceInstance, UsageResourceRecord } from '../types/ibm-cloud.types';
import type {
  ResourceQueryOptions,
  ResourceCostDetail,
  SubTypeAggregation,
  TypeAggregation,
  ResourceGroupAggregation,
  CreatorAggregation,
  HierarchicalCostBreakdown,
} from '../types/resource.types';
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
   * Creates a comprehensive hierarchical cost breakdown table
   * Aggregates costs from resource level -> sub_type -> type -> resource group
   * @param resources - Array of resource instances
   * @param usageRecords - Array of usage records with cost data
   * @param resourceGroupNames - Map of resource group IDs to names
   * @returns Hierarchical cost breakdown with drill-down capabilities
   */
  public createHierarchicalCostBreakdown(
    resources: ResourceInstance[],
    usageRecords: UsageResourceRecord[],
    resourceGroupNames: Map<string, string> = new Map(),
  ): HierarchicalCostBreakdown {
    logger.info('Creating hierarchical cost breakdown', {
      resourceCount: resources.length,
      usageRecordCount: usageRecords.length,
    });

    // Create lookup map for usage records
    const usageMap = this.createUsageMap(usageRecords);

    // Build resource cost details with usage data
    const resourceCostDetails = this.buildResourceCostDetails(
      resources,
      usageMap,
      resourceGroupNames,
    );

    // Aggregate by resource group
    const resourceGroups = this.aggregateByResourceGroup(resourceCostDetails);

    // Calculate totals
    const totalCost = resourceGroups.reduce((sum, rg) => sum + rg.cost, 0);
    const totalResourceCount = resourceGroups.reduce((sum, rg) => sum + rg.resourceCount, 0);
    const currency = resourceGroups[0]?.currency || 'USD';

    const breakdown: HierarchicalCostBreakdown = {
      resourceGroups,
      totalCost,
      currency,
      totalResourceCount,
      generatedAt: new Date(),
    };

    logger.info('Hierarchical cost breakdown completed', {
      resourceGroupCount: resourceGroups.length,
      totalCost,
      totalResourceCount,
    });

    return breakdown;
  }

  /**
   * Creates a lookup map for usage records by resource ID
   * Enhanced with better matching logic to reduce unmatched resources
   * @param usageRecords - Array of usage records
   * @returns Map of resource ID to usage record
   */
  private createUsageMap(usageRecords: UsageResourceRecord[]): Map<string, UsageResourceRecord> {
    const usageMap = new Map<string, UsageResourceRecord>();

    for (const record of usageRecords) {
      // Try multiple ID fields for matching
      const ids = [
        record.resource_id,
        record.resource_instance_id,
        record.resource_name, // Add name-based matching as fallback
      ].filter((id): id is string => Boolean(id));

      for (const id of ids) {
        // Only set if not already present to preserve first match
        if (!usageMap.has(id)) {
          usageMap.set(id, record);
        }
      }
    }

    logger.debug('Created usage map', {
      totalRecords: usageRecords.length,
      uniqueKeys: usageMap.size,
    });

    return usageMap;
  }

  /**
   * Builds detailed resource cost information
   * Enhanced with better matching and diagnostic logging
   * @param resources - Array of resource instances
   * @param usageMap - Map of resource IDs to usage records
   * @param resourceGroupNames - Map of resource group IDs to names
   * @returns Array of resource cost details
   */
  private buildResourceCostDetails(
    resources: ResourceInstance[],
    usageMap: Map<string, UsageResourceRecord>,
    resourceGroupNames: Map<string, string>,
  ): ResourceCostDetail[] {
    const details: ResourceCostDetail[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const resource of resources) {
      // Find matching usage record with enhanced matching
      const usage =
        usageMap.get(resource.id) ||
        usageMap.get(resource.guid) ||
        usageMap.get(resource.crn) ||
        usageMap.get(resource.name); // Add name-based matching

      // Calculate cost from usage record
      let cost = 0;
      let currency = 'USD';

      if (usage) {
        const billableCost = usage.billable_cost || usage.billable_charges || 0;
        const nonBillableCost = usage.non_billable_cost || usage.non_billable_charges || 0;
        cost = billableCost + nonBillableCost;
        currency = usage.currency || 'USD';
        matchedCount++;
      } else {
        unmatchedCount++;
        logger.debug('Resource without usage data', {
          resourceId: resource.id,
          resourceName: resource.name,
          resourceType: resource.type,
        });
      }

      // Extract creator email
      const creatorEmail = this.extractCreatorEmailFromResource(resource);

      // Get resource group name - handle undefined resourceGroupId
      const resourceGroupName = resource.resourceGroupId
        ? (resourceGroupNames.get(resource.resourceGroupId) || 'Default')
        : 'Default';

      // Derive subType from resource properties
      const resourceSubType = this.deriveResourceSubType(resource, usage);

      const detail: ResourceCostDetail = {
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.type || 'unknown',
        resourceSubType,
        cost,
        currency,
        creatorEmail,
        resourceGroupId: resource.resourceGroupId || 'default',
        resourceGroupName,
        region: resource.regionId,
        createdAt: resource.createdAt,
      };

      details.push(detail);
    }

    logger.info('Resource cost details built', {
      totalResources: resources.length,
      matchedResources: matchedCount,
      unmatchedResources: unmatchedCount,
      matchRate: `${((matchedCount / resources.length) * 100).toFixed(1)}%`,
    });

    return details;
  }

  /**
   * Extracts creator email from resource
   * @param resource - Resource instance
   * @returns Creator email or undefined
   */
  private extractCreatorEmailFromResource(resource: ResourceInstance): string | undefined {
    // Priority 1: Use enriched creator profile email
    if (resource.creatorProfile?.email) {
      return resource.creatorProfile.email;
    }

    // Priority 2: Check if createdBy is an email
    if (resource.createdBy && resource.createdBy.includes('@')) {
      return resource.createdBy;
    }

    // Priority 3: Use IAM ID from creator profile
    if (resource.creatorProfile?.iamId) {
      return resource.creatorProfile.iamId;
    }

    // Priority 4: Fall back to raw createdBy
    if (resource.createdBy) {
      return resource.createdBy;
    }

    return undefined;
  }

  /**
   * Determines creator type and display email from creator identifier
   * @param creatorId - Creator identifier (email, IBMid, or ServiceId)
   * @returns Creator type and display email
   */
  private determineCreatorInfo(creatorId: string): {
    type: 'user' | 'service' | 'unknown';
    displayEmail?: string;
  } {
    // Check if it's an IBMid
    if (creatorId.startsWith('IBMid-')) {
      // For IBMid, we'll show the ID as-is but mark it as a user
      // In a future enhancement, this could be resolved via User Management API
      return { type: 'user', displayEmail: undefined };
    }

    // Check if it's a ServiceId
    if (creatorId.startsWith('iam-ServiceId-')) {
      // For ServiceId, mark as service and indicate unknown email
      return { type: 'service', displayEmail: undefined };
    }

    // If it's already an email
    if (creatorId.includes('@')) {
      return { type: 'user', displayEmail: creatorId };
    }

    // Unknown type
    return { type: 'unknown', displayEmail: undefined };
  }
  /**
   * Derives resource sub-type from resource properties and usage data
   * @param resource - Resource instance
   * @param usage - Usage record (optional)
   * @returns Derived sub-type string
   */
  private deriveResourceSubType(resource: ResourceInstance, usage?: UsageResourceRecord): string {
    // Priority 1: Use explicit subType if available
    if (resource.subType) {
      return resource.subType;
    }

    // Priority 2: Derive from usage record plan name
    if (usage?.plan_name) {
      return usage.plan_name;
    }

    // Priority 3: Extract from resource name patterns
    // Common patterns: "service-name-plan" or "name-tier"
    const nameParts = resource.name.toLowerCase().split('-');
    if (nameParts.length > 1) {
      const lastPart = nameParts[nameParts.length - 1];
      // Check if last part looks like a plan/tier identifier
      const planKeywords = ['lite', 'standard', 'premium', 'enterprise', 'free', 'pro', 'basic', 'advanced'];
      if (lastPart && planKeywords.includes(lastPart)) {
        return lastPart;
      }
    }

    // Priority 4: Use region as sub-type if available
    if (resource.regionId) {
      return resource.regionId;
    }

    // Priority 5: Extract from CRN if available (get region or other identifier)
    if (resource.crn) {
      const crnParts = resource.crn.split(':');
      // CRN format: crn:v1:bluemix:public:service:region:...
      if (crnParts.length >= 6 && crnParts[5]) {
        return crnParts[5]; // Region from CRN
      }
    }

    // Priority 6: Default to 'default' instead of resource type to avoid duplication
    return 'default';
  }


  /**
   * Aggregates resource cost details by resource group
   * Hierarchy: Resource Group → Creator → Type → Sub-Type → Resources
   * @param details - Array of resource cost details
   * @returns Array of resource group aggregations
   */
  private aggregateByResourceGroup(details: ResourceCostDetail[]): ResourceGroupAggregation[] {
    const groupMap = new Map<string, ResourceCostDetail[]>();

    // Group by resource group ID
    for (const detail of details) {
      const groupId = detail.resourceGroupId || 'unknown';
      const existing = groupMap.get(groupId) || [];
      groupMap.set(groupId, [...existing, detail]);
    }

    const resourceGroups: ResourceGroupAggregation[] = [];

    for (const [groupId, groupDetails] of groupMap.entries()) {
      // Aggregate by creator (second level in hierarchy)
      const creators = this.aggregateByCreator(groupDetails);

      // Calculate totals from creators
      const cost = creators.reduce((sum, creator) => sum + creator.cost, 0);
      const resourceCount = creators.reduce((sum, creator) => sum + creator.resourceCount, 0);
      const currency = groupDetails[0]?.currency || 'USD';
      const resourceGroupName = groupDetails[0]?.resourceGroupName || 'Unknown';

      const resourceGroup: ResourceGroupAggregation = {
        resourceGroupId: groupId,
        resourceGroupName,
        cost,
        currency,
        resourceCount,
        creators,
      };

      resourceGroups.push(resourceGroup);
    }

    // Sort by cost descending
    resourceGroups.sort((a, b) => b.cost - a.cost);

    return resourceGroups;
  }

  /**
   * Aggregates resource cost details by type
   * @param details - Array of resource cost details
   * @returns Array of type aggregations
   */
  private aggregateByType(details: ResourceCostDetail[]): TypeAggregation[] {
    const typeMap = new Map<string, ResourceCostDetail[]>();

    // Group by resource type
    for (const detail of details) {
      const type = detail.resourceType;
      const existing = typeMap.get(type) || [];
      typeMap.set(type, [...existing, detail]);
    }

    const types: TypeAggregation[] = [];

    for (const [type, typeDetails] of typeMap.entries()) {
      // Aggregate sub-types for this type
      const subTypes = this.aggregateBySubType(typeDetails);

      // Calculate totals (rolled up from sub-types)
      const cost = subTypes.reduce((sum, subType) => sum + subType.cost, 0);
      const resourceCount = subTypes.reduce((sum, subType) => sum + subType.resourceCount, 0);
      const currency = typeDetails[0]?.currency || 'USD';

      const typeAgg: TypeAggregation = {
        type,
        cost,
        currency,
        resourceCount,
        subTypes,
      };

      types.push(typeAgg);
    }

    // Sort by cost descending
    types.sort((a, b) => b.cost - a.cost);

    return types;
  }

  /**
   * Aggregates resource cost details by sub-type
   * @param details - Array of resource cost details
   * @returns Array of sub-type aggregations
   */
  private aggregateBySubType(details: ResourceCostDetail[]): SubTypeAggregation[] {
    const subTypeMap = new Map<string, ResourceCostDetail[]>();

    // Group by resource sub-type
    for (const detail of details) {
      const subType = detail.resourceSubType;
      const existing = subTypeMap.get(subType) || [];
      subTypeMap.set(subType, [...existing, detail]);
    }

    const subTypes: SubTypeAggregation[] = [];

    for (const [subType, subTypeDetails] of subTypeMap.entries()) {
      // Calculate totals from individual resources
      const cost = subTypeDetails.reduce((sum, detail) => sum + detail.cost, 0);
      const resourceCount = subTypeDetails.length;
      const currency = subTypeDetails[0]?.currency || 'USD';

      const subTypeAgg: SubTypeAggregation = {
        subType,
        cost,
        currency,
        resourceCount,
        resources: subTypeDetails,
      };

      subTypes.push(subTypeAgg);
    }

    // Sort by cost descending
    subTypes.sort((a, b) => b.cost - a.cost);

    return subTypes;
  }

  /**
   * Aggregates resource cost details by creator
   * @param details - Array of resource cost details
   * @returns Array of creator aggregations
   */
  private aggregateByCreator(details: ResourceCostDetail[]): CreatorAggregation[] {
    const creatorMap = new Map<string, ResourceCostDetail[]>();

    // Group by creator email
    for (const detail of details) {
      const creator = detail.creatorEmail || 'unknown';
      const existing = creatorMap.get(creator) || [];
      creatorMap.set(creator, [...existing, detail]);
    }

    const creators: CreatorAggregation[] = [];

    for (const [creatorEmail, creatorDetails] of creatorMap.entries()) {
      // Aggregate types for this creator
      const types = this.aggregateByType(creatorDetails);

      // Calculate totals
      const cost = types.reduce((sum, type) => sum + type.cost, 0);
      const resourceCount = types.reduce((sum, type) => sum + type.resourceCount, 0);
      const currency = creatorDetails[0]?.currency || 'USD';

      // Determine creator type and display email
      const creatorInfo = this.determineCreatorInfo(creatorEmail);

      const creatorAggregation: CreatorAggregation = {
        creatorEmail,
        creatorDisplayEmail: creatorInfo.displayEmail,
        creatorType: creatorInfo.type,
        cost,
        currency,
        resourceCount,
        types,
      };

      creators.push(creatorAggregation);
    }

    // Sort by cost descending
    creators.sort((a, b) => b.cost - a.cost);

    return creators;
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