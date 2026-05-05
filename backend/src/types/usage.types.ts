import type { UsageResourceRecord } from './ibm-cloud.types';

/**
 * Usage report for a specific time period
 */
export interface UsageReport {
  readonly accountId: string;
  readonly billingMonth: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly resources: UsageResourceRecord[];
  readonly totalCost: number;
  readonly currency: string;
}

/**
 * Usage metrics for a single resource
 */
export interface UsageMetric {
  readonly resourceId: string;
  readonly resourceInstanceId?: string;
  readonly resourceName: string;
  readonly serviceName: string;
  readonly planName: string;
  readonly billableCharges: number;
  readonly nonBillableCharges: number;
  readonly totalCharges: number;
  readonly currency: string;
  readonly pricingRegion?: string;
  readonly resourceGroupName?: string;
}

/**
 * Cost data aggregated by time period
 */
export interface CostData {
  readonly period: string; // YYYY-MM format
  readonly totalCost: number;
  readonly billableCost: number;
  readonly nonBillableCost: number;
  readonly currency: string;
  readonly resourceCount: number;
}

/**
 * Options for collecting usage data
 */
export interface UsageCollectionOptions {
  readonly startMonth: string; // YYYY-MM format
  readonly endMonth: string; // YYYY-MM format
  readonly includeResourceDetails?: boolean;
  readonly onProgress?: (month: string, completed: number, total: number) => void;
}

/**
 * Multi-month usage report
 */
export interface MultiMonthUsageReport {
  readonly accountId: string;
  readonly startMonth: string;
  readonly endMonth: string;
  readonly months: UsageReport[];
  readonly totalCost: number;
  readonly currency: string;
  readonly collectedAt: Date;
}

// Made with Bob