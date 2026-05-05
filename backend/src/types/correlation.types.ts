import type { ResourceInstance, UsageResourceRecord } from './ibm-cloud.types';

/**
 * Correlated data combining resource and usage information
 */
export interface CorrelatedData {
  readonly resource: ResourceInstance;
  readonly usage: UsageResourceRecord | null;
  readonly matchedBy: 'resource_id' | 'resource_instance_id' | 'crn' | 'none';
  readonly creatorEmail?: string;
  readonly totalCost: number;
  readonly currency: string;
}

/**
 * User spending aggregated across all resources
 */
export interface UserSpending {
  readonly userEmail: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly iamId?: string;
  readonly totalCost: number;
  readonly currency: string;
  readonly resourceCount: number;
  readonly resources: Array<{
    readonly resourceId: string;
    readonly resourceName: string;
    readonly serviceName: string;
    readonly cost: number;
  }>;
  readonly monthlyBreakdown: MonthlySpending[];
}

/**
 * Monthly spending breakdown
 */
export interface MonthlySpending {
  readonly month: string; // YYYY-MM format
  readonly cost: number;
  readonly currency: string;
  readonly resourceCount: number;
}

/**
 * Time series data for trend analysis
 */
export interface TimeSeriesData {
  readonly period: string; // YYYY-MM format
  readonly value: number;
  readonly label?: string;
}

/**
 * Correlation statistics
 */
export interface CorrelationStats {
  readonly totalResources: number;
  readonly matchedResources: number;
  readonly unmatchedResources: number;
  readonly matchRate: number; // percentage
  readonly matchedBy: {
    readonly resource_id: number;
    readonly resource_instance_id: number;
    readonly crn: number;
  };
}

/**
 * Options for data correlation
 */
export interface CorrelationOptions {
  readonly includeUnmatched?: boolean;
  readonly extractCreatorEmail?: boolean;
  readonly aggregateByUser?: boolean;
}

/**
 * Result of correlation operation
 */
export interface CorrelationResult {
  readonly correlatedData: CorrelatedData[];
  readonly userSpending: UserSpending[];
  readonly stats: CorrelationStats;
  readonly correlatedAt: Date;
}

// Made with Bob