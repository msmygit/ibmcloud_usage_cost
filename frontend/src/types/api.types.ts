/**
 * Frontend API Types
 * Mirrors backend API types for type-safe communication
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly metadata?: ResponseMetadata;
}

/**
 * API error structure
 */
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly statusCode: number;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  readonly requestId: string;
  readonly timestamp: string;
  readonly duration?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  readonly limit?: number;
  readonly offset?: number;
  readonly cursor?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly pagination: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
    readonly hasMore: boolean;
    readonly nextCursor?: string;
  };
}

/**
 * Sort parameters
 */
export interface SortParams {
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Time period for reports
 */
export type TimePeriod = 'month' | 'quarter' | 'year' | 'custom';

/**
 * Date range for custom reports
 */
export interface DateRange {
  readonly startDate: string;
  readonly endDate: string;
}

/**
 * Report filters
 */
export interface ReportFilters {
  readonly userEmails?: string[];
  readonly serviceNames?: string[];
  readonly resourceGroups?: string[];
  readonly regions?: string[];
  readonly minCost?: number;
  readonly maxCost?: number;
}

/**
 * Request to generate user spending report
 */
export interface GenerateUserSpendingRequest {
  readonly accountId: string;
  readonly period: TimePeriod;
  readonly dateRange?: DateRange;
  readonly filters?: ReportFilters;
  readonly includeForecasts?: boolean;
  readonly forecastMonths?: number;
}

/**
 * Request to generate team spending report
 */
export interface GenerateTeamSpendingRequest {
  readonly accountId: string;
  readonly teamName?: string;
  readonly period: TimePeriod;
  readonly dateRange?: DateRange;
  readonly filters?: ReportFilters;
  readonly includeForecasts?: boolean;
}

/**
 * Response for report generation initiation
 */
export interface GenerateReportResponse {
  readonly reportId: string;
  readonly status: 'pending' | 'processing';
  readonly estimatedTime: number;
  readonly websocketRoom?: string;
}

/**
 * Report export format
 */
export type ReportExportFormat = 'json' | 'csv' | 'pdf' | 'excel' | 'png' | 'jpeg';

/**
 * Request to export a report
 */
export interface ExportReportRequest {
  readonly format: ReportExportFormat;
  readonly includeCharts?: boolean;
  readonly includeRawData?: boolean;
}

/**
 * Resources query parameters
 */
export interface ResourcesQueryParams extends PaginationParams, SortParams {
  readonly accountId: string;
  readonly resourceGroupId?: string;
  readonly refresh?: boolean;
}

/**
 * Usage query parameters
 */
export interface UsageQueryParams {
  readonly accountId: string;
  readonly month?: string;
  readonly startMonth?: string;
  readonly endMonth?: string;
}

/**
 * Cache statistics response
 */
export interface CacheStatsResponse {
  readonly memory: {
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
    readonly size: number;
    readonly keys: number;
  };
  readonly file: {
    readonly hits: number;
    readonly misses: number;
    readonly hitRate: number;
    readonly size: number;
    readonly files: number;
  };
  readonly overall: {
    readonly totalHits: number;
    readonly totalMisses: number;
    readonly overallHitRate: number;
  };
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  readonly status: 'ok' | 'degraded' | 'down';
  readonly timestamp: string;
  readonly uptime: number;
  readonly environment: string;
  readonly websocketEnabled: boolean;
  readonly services?: {
    readonly cache?: 'ok' | 'degraded' | 'down';
    readonly ibmCloud?: 'ok' | 'degraded' | 'down';
  };
}

/**
 * Validation error details
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
  readonly retryAfter?: number;
}

/**
 * IBM Cloud Account
 */
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly resourceGroupCount: number;
}

/**
 * Response for accounts list
 */
export interface AccountsResponse {
  readonly accounts: Account[];
  readonly count: number;
}

/**
 * Creator profile information
 */
export interface CreatorProfile {
  readonly iamId?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

/**
 * Resource instance with enriched creator profile
 */
export interface ResourceInstance {
  readonly id: string;
  readonly guid: string;
  readonly crn: string;
  readonly name: string;
  readonly regionId?: string;
  readonly resourceGroupId?: string;
  readonly resource_group_id?: string;
  readonly resourceGroupName?: string;
  readonly resourcePlanId?: string;
  readonly targetCrn?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly createdBy?: string;
  readonly created_by?: string;
  readonly state?: string;
  readonly type?: string;
  readonly subType?: string;
  readonly tags?: string[];
  readonly extensions?: Record<string, unknown>;
  readonly creatorProfile?: CreatorProfile;
}

/**
 * Account resource with service-level cost data
 */
export interface AccountResource {
  readonly resource_id: string;
  readonly resource_name?: string;
  readonly billable_cost: number;
  readonly billable_rated_cost: number;
  readonly non_billable_cost: number;
  readonly non_billable_rated_cost: number;
  readonly plans?: Array<{
    readonly plan_id: string;
    readonly plan_name?: string;
    readonly pricing_region?: string;
    readonly billable: boolean;
    readonly cost: number;
    readonly rated_cost: number;
  }>;
  readonly discounts?: Array<{
    readonly ref: string;
    readonly name: string;
    readonly display_name?: string;
    readonly discount: number;
  }>;
}

/**
 * Account summary response with enriched data
 */
export interface AccountSummaryResponse {
  readonly accountId: string;
  readonly month: string;
  readonly account_id: string;
  readonly billing_country_code?: string;
  readonly billing_currency_code?: string;
  readonly pricing_country?: string;
  readonly currency_code?: string;
  readonly currency_rate?: number;
  readonly resources: AccountResource[];
  readonly resourceInstances: ResourceInstance[];
  readonly resourceInstanceCount: number;
  readonly resourceGroups?: Array<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly costAllocation?: {
    readonly totalAllocatableCost: number;
    readonly unallocatedCost: number;
    readonly creatorCosts: Array<{
      readonly creatorKey: string;
      readonly cost: number;
      readonly resourceCount: number;
    }>;
    readonly resourceGroupCosts: Array<{
      readonly resourceGroupId: string;
      readonly resourceGroupName: string;
      readonly cost: number;
      readonly resourceCount: number;
      readonly resourceNames: string[];
    }>;
  };
}

