import type { CorrelatedData, UserSpending, MonthlySpending } from './correlation.types';

/**
 * Time period for reports
 */
export type TimePeriod = 'month' | 'quarter' | 'year' | 'custom';

/**
 * Report status
 */
export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Date range for custom reports
 */
export interface DateRange {
  readonly startDate: string; // ISO 8601 format
  readonly endDate: string; // ISO 8601 format
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
 * Base report metadata
 */
export interface ReportMetadata {
  readonly reportId: string;
  readonly generatedAt: Date;
  readonly accountId: string;
  readonly period: TimePeriod;
  readonly dateRange: DateRange;
  readonly filters?: ReportFilters;
  readonly status: ReportStatus;
}

/**
 * Cost breakdown by dimension
 */
export interface CostBreakdown {
  readonly byService: Array<{
    readonly serviceName: string;
    readonly cost: number;
    readonly percentage: number;
    readonly resourceCount: number;
  }>;
  readonly byRegion: Array<{
    readonly region: string;
    readonly cost: number;
    readonly percentage: number;
    readonly resourceCount: number;
  }>;
  readonly byResourceGroup: Array<{
    readonly resourceGroup: string;
    readonly cost: number;
    readonly percentage: number;
    readonly resourceCount: number;
  }>;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  readonly period: string; // YYYY-MM format
  readonly cost: number;
  readonly resourceCount: number;
  readonly userCount: number;
  readonly growthRate?: number; // percentage
}

/**
 * Forecast data point
 */
export interface ForecastDataPoint {
  readonly period: string; // YYYY-MM format
  readonly predictedCost: number;
  readonly confidenceInterval: {
    readonly lower: number;
    readonly upper: number;
  };
}

/**
 * Trend analysis
 */
export interface TrendAnalysis {
  readonly historical: TrendDataPoint[];
  readonly forecast: ForecastDataPoint[];
  readonly averageMonthlyCost: number;
  readonly totalCost: number;
  readonly growthRate: number; // percentage
  readonly trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * User spending report
 */
export interface UserSpendingReport extends ReportMetadata {
  readonly type: 'user-spending';
  readonly users: UserSpending[];
  readonly topSpenders: Array<{
    readonly userEmail: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly iamId?: string;
    readonly totalCost: number;
    readonly resourceCount: number;
    readonly percentage: number;
  }>;
  readonly summary: {
    readonly totalCost: number;
    readonly totalUsers: number;
    readonly totalResources: number;
    readonly averageCostPerUser: number;
    readonly currency: string;
  };
  readonly costBreakdown: CostBreakdown;
  readonly monthlyTrend: TrendDataPoint[];
}

/**
 * Team spending report (aggregated view)
 */
export interface TeamSpendingReport extends ReportMetadata {
  readonly type: 'team-spending';
  readonly teamName?: string;
  readonly totalCost: number;
  readonly currency: string;
  readonly userCount: number;
  readonly resourceCount: number;
  readonly costBreakdown: CostBreakdown;
  readonly trendAnalysis: TrendAnalysis;
  readonly topServices: Array<{
    readonly serviceName: string;
    readonly cost: number;
    readonly percentage: number;
  }>;
  readonly topUsers: Array<{
    readonly userEmail: string;
    readonly cost: number;
    readonly percentage: number;
  }>;
}

/**
 * Time series report
 */
export interface TimeSeriesReport extends ReportMetadata {
  readonly type: 'time-series';
  readonly timeSeries: Array<{
    readonly period: string;
    readonly cost: number;
    readonly resourceCount: number;
    readonly userCount: number;
  }>;
  readonly aggregation: 'daily' | 'weekly' | 'monthly';
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  readonly accountId: string;
  readonly period: TimePeriod;
  readonly dateRange?: DateRange;
  readonly filters?: ReportFilters;
  readonly includeForecasts?: boolean;
  readonly forecastMonths?: number;
  readonly aggregateByUser?: boolean;
  readonly includeBreakdowns?: boolean;
}

/**
 * Report generation progress
 */
export interface ReportProgress {
  readonly reportId: string;
  readonly status: ReportStatus;
  readonly progress: number; // 0-100
  readonly currentStep: string;
  readonly estimatedTimeRemaining?: number; // seconds
  readonly error?: string;
}

/**
 * Cached report entry
 */
export interface CachedReport {
  readonly reportId: string;
  readonly report: UserSpendingReport | TeamSpendingReport | TimeSeriesReport;
  readonly cachedAt: Date;
  readonly expiresAt: Date;
}

/**
 * Report export format
 */
export type ReportExportFormat = 'json' | 'csv' | 'pdf' | 'excel' | 'pptx';

/**
 * Report export options
 */
export interface ReportExportOptions {
  readonly format: ReportExportFormat;
  readonly includeCharts?: boolean;
  readonly includeRawData?: boolean;
}

// Made with Bob