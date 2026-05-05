/**
 * Frontend Report Types
 * Mirrors backend report types for type-safe data handling
 */

/**
 * Report status
 */
export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Base report metadata
 */
export interface ReportMetadata {
  readonly reportId: string;
  readonly generatedAt: Date | string;
  readonly accountId: string;
  readonly period: 'month' | 'quarter' | 'year' | 'custom';
  readonly dateRange: {
    readonly startDate: string;
    readonly endDate: string;
  };
  readonly filters?: {
    readonly userEmails?: string[];
    readonly serviceNames?: string[];
    readonly resourceGroups?: string[];
    readonly regions?: string[];
    readonly minCost?: number;
    readonly maxCost?: number;
  };
  readonly status: ReportStatus;
}

/**
 * User spending data
 */
export interface UserSpending {
  readonly userEmail: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly iamId?: string;
  readonly totalCost: number;
  readonly resourceCount: number;
  readonly resources: Array<{
    readonly resourceId: string;
    readonly resourceName: string;
    readonly serviceName: string;
    readonly cost: number;
    readonly region?: string;
  }>;
  readonly monthlyBreakdown: Array<{
    readonly month: string;
    readonly cost: number;
    readonly resourceCount: number;
  }>;
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
  readonly period: string;
  readonly cost: number;
  readonly resourceCount: number;
  readonly userCount: number;
  readonly growthRate?: number;
}

/**
 * Forecast data point
 */
export interface ForecastDataPoint {
  readonly period: string;
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
  readonly growthRate: number;
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
 * Team spending report
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
 * Union type for all report types
 */
export type Report = UserSpendingReport | TeamSpendingReport | TimeSeriesReport;

/**
 * Report generation progress
 */
export interface ReportProgress {
  readonly reportId: string;
  readonly status: ReportStatus;
  readonly progress: number;
  readonly currentStep: string;
  readonly estimatedTimeRemaining?: number;
  readonly error?: string;
}

// Made with Bob
