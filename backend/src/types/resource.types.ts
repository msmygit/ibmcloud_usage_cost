import type { ResourceInstance, UsageResourceRecord } from './ibm-cloud.types';

export interface ProgressCallback {
  (processedCount: number): void;
}

export interface ResourceQueryOptions {
  readonly limit?: number;
  readonly resourceGroupId?: string;
  readonly onProgress?: ProgressCallback;
}

export interface UsageQueryOptions {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ResourceUsageSummary {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly serviceName?: string;
  readonly planName?: string;
  readonly cost: number;
  readonly currency: string;
}

export interface CorrelatedResourceUsage {
  readonly resource: ResourceInstance;
  readonly usage: UsageResourceRecord | null;
  readonly matchedBy: 'resource_id' | 'resource_instance_id' | 'name' | 'none';
}

/**
 * Individual resource with cost information
 */
export interface ResourceCostDetail {
  readonly resourceId: string;
  readonly resourceName: string;
  readonly resourceType: string;
  readonly resourceSubType: string;
  readonly cost: number;
  readonly currency: string;
  readonly creatorEmail?: string;
  readonly resourceGroupId?: string;
  readonly resourceGroupName?: string;
  readonly region?: string;
  readonly createdAt?: string;
}

/**
 * Sub-type level aggregation
 */
export interface SubTypeAggregation {
  readonly subType: string;
  readonly cost: number;
  readonly currency: string;
  readonly resourceCount: number;
  readonly resources: ResourceCostDetail[];
}

/**
 * Type level aggregation (rolls up from sub-types)
 */
export interface TypeAggregation {
  readonly type: string;
  readonly cost: number;
  readonly currency: string;
  readonly resourceCount: number;
  readonly subTypes: SubTypeAggregation[];
}

/**
 * Creator level aggregation (second level under resource group)
 * Contains types for this creator
 */
export interface CreatorAggregation {
  readonly creatorEmail: string;
  readonly creatorDisplayEmail?: string; // Resolved email if different from ID
  readonly creatorType?: 'user' | 'service' | 'unknown'; // Type of creator
  readonly cost: number;
  readonly currency: string;
  readonly resourceCount: number;
  readonly types: TypeAggregation[];
}

/**
 * Resource group level aggregation (rolls up from creators)
 */
export interface ResourceGroupAggregation {
  readonly resourceGroupId: string;
  readonly resourceGroupName: string;
  readonly cost: number;
  readonly currency: string;
  readonly resourceCount: number;
  readonly creators: CreatorAggregation[];
}

/**
 * @deprecated Use CreatorAggregation instead
 */
export interface CreatorCostBreakdown {
  readonly creatorEmail: string;
  readonly cost: number;
  readonly currency: string;
  readonly resourceCount: number;
  readonly types: TypeAggregation[];
}

/**
 * Complete hierarchical cost breakdown
 */
export interface HierarchicalCostBreakdown {
  readonly resourceGroups: ResourceGroupAggregation[];
  readonly totalCost: number;
  readonly currency: string;
  readonly totalResourceCount: number;
  readonly generatedAt: Date;
}

// Made with Bob
