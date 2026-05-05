import type {
  ReportFilters,
  TimePeriod,
  DateRange,
  ReportExportFormat,
  UserSpendingReport,
  TeamSpendingReport,
  TimeSeriesReport,
} from './report.types';

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
  readonly duration?: number; // milliseconds
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
  readonly estimatedTime: number; // seconds
  readonly websocketRoom?: string;
}

/**
 * Response for getting a report
 */
export interface GetReportResponse {
  readonly report: UserSpendingReport | TeamSpendingReport | TimeSeriesReport;
  readonly status: 'completed';
  readonly cachedAt?: string;
}

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
  readonly month?: string; // YYYY-MM format
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
 * Validation error response
 */
export interface ValidationErrorResponse extends ApiError {
  readonly code: 'VALIDATION_ERROR';
  readonly details: {
    readonly errors: ValidationError[];
  };
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number; // Unix timestamp
  readonly retryAfter?: number; // seconds
}

/**
 * Rate limit error response
 */
export interface RateLimitErrorResponse extends ApiError {
  readonly code: 'RATE_LIMIT_EXCEEDED';
  readonly details: {
    readonly rateLimit: RateLimitInfo;
  };
}

// Made with Bob