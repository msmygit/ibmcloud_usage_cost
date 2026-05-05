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

// Made with Bob
