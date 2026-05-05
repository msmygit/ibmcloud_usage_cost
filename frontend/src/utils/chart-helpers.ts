/**
 * Chart Helper Utilities
 * Functions for transforming data for chart components
 */

import type {
  ChartDataPoint,
  PieChartDataPoint,
  BarChartDataPoint,
} from '../types/chart.types';
import type {
  Report,
  UserSpendingReport,
  TeamSpendingReport,
  TrendDataPoint,
} from '../types/report.types';

/**
 * Color palettes for charts
 */
export const CHART_COLORS = {
  primary: [
    '#3b82f6', // blue-500
    '#10b981', // green-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
  ],
  blue: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
  green: ['#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857'],
  purple: ['#e9d5ff', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8'],
  orange: ['#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
};

/**
 * Transform user spending data for pie chart
 */
export function transformUserSpendingForPieChart(
  report: UserSpendingReport
): PieChartDataPoint[] {
  return report.topSpenders.map((spender, index) => ({
    name: [spender.firstName, spender.lastName].filter(Boolean).join(' ') || spender.userEmail || spender.iamId || 'Unknown',
    value: spender.totalCost,
    percentage: spender.percentage,
    color: CHART_COLORS.primary[index % CHART_COLORS.primary.length],
  }));
}

/**
 * Transform cost breakdown by service for pie chart
 */
export function transformServiceBreakdownForPieChart(
  report: Report
): PieChartDataPoint[] {
  if (!('costBreakdown' in report)) return [];
  
  return report.costBreakdown.byService.map((service, index) => ({
    name: service.serviceName,
    value: service.cost,
    percentage: service.percentage,
    color: CHART_COLORS.primary[index % CHART_COLORS.primary.length],
  }));
}

/**
 * Transform cost breakdown by region for pie chart
 */
export function transformRegionBreakdownForPieChart(
  report: Report
): PieChartDataPoint[] {
  if (!('costBreakdown' in report)) return [];
  
  return report.costBreakdown.byRegion.map((region, index) => ({
    name: region.region,
    value: region.cost,
    percentage: region.percentage,
    color: CHART_COLORS.primary[index % CHART_COLORS.primary.length],
  }));
}

/**
 * Transform monthly trend data for line chart
 */
export function transformMonthlyTrendForLineChart(
  trendData: TrendDataPoint[]
): ChartDataPoint[] {
  return trendData.map((point) => ({
    name: point.period,
    value: point.cost,
    cost: point.cost,
    resources: point.resourceCount,
    users: point.userCount,
  }));
}

/**
 * Transform trend analysis for area chart
 */
export function transformTrendAnalysisForAreaChart(
  report: TeamSpendingReport
): ChartDataPoint[] {
  const historical = report.trendAnalysis.historical.map((point) => ({
    name: point.period,
    value: point.cost,
    actual: point.cost,
    forecast: 0,
  }));

  const forecast = report.trendAnalysis.forecast.map((point) => ({
    name: point.period,
    value: point.predictedCost,
    actual: 0,
    forecast: point.predictedCost,
    lower: point.confidenceInterval.lower,
    upper: point.confidenceInterval.upper,
  }));

  return [...historical, ...forecast];
}

/**
 * Transform user spending for bar chart
 */
export function transformUserSpendingForBarChart(
  report: UserSpendingReport,
  limit: number = 10
): BarChartDataPoint[] {
  return report.topSpenders.slice(0, limit).map((spender) => ({
    name:
      [spender.firstName, spender.lastName].filter(Boolean).join(' ') ||
      spender.userEmail.split('@')[0] ||
      spender.userEmail ||
      spender.iamId ||
      'Unknown',
    cost: spender.totalCost,
    resources: spender.resourceCount,
  }));
}

/**
 * Transform service costs for bar chart
 */
export function transformServiceCostsForBarChart(
  report: Report,
  limit: number = 10
): BarChartDataPoint[] {
  if (!('costBreakdown' in report)) return [];
  
  return report.costBreakdown.byService.slice(0, limit).map((service) => ({
    name: service.serviceName,
    cost: service.cost,
    resources: service.resourceCount,
  }));
}

/**
 * Calculate chart dimensions based on container
 */
export function calculateChartDimensions(
  containerWidth: number,
  aspectRatio: number = 16 / 9
): { width: number; height: number } {
  const width = Math.min(containerWidth, 1200);
  const height = width / aspectRatio;
  return { width, height };
}

/**
 * Generate gradient colors for area charts
 */
export function generateGradientId(chartId: string, colorName: string): string {
  return `gradient-${chartId}-${colorName}`;
}

/**
 * Get color by index from palette
 */
export function getColorByIndex(index: number, palette: string[] = CHART_COLORS.primary): string {
  return palette[index % palette.length]!;
}

/**
 * Transform data for stacked bar chart
 */
export function transformForStackedBarChart(
  data: Record<string, Record<string, number>>,
  categories: string[]
): BarChartDataPoint[] {
  return Object.entries(data).map(([name, values]) => ({
    name,
    ...values,
  }));
}

/**
 * Calculate percentage distribution
 */
export function calculatePercentageDistribution(
  values: number[]
): number[] {
  const total = values.reduce((sum, val) => sum + val, 0);
  if (total === 0) return values.map(() => 0);
  return values.map((val) => (val / total) * 100);
}

/**
 * Group data by time period
 */
export function groupByTimePeriod(
  data: Array<{ date: string; value: number }>,
  period: 'day' | 'week' | 'month'
): ChartDataPoint[] {
  const grouped = new Map<string, number>();
  
  data.forEach(({ date, value }) => {
    const dateObj = new Date(date);
    let key: string;
    
    switch (period) {
      case 'day':
        key = dateObj.toISOString().split('T')[0]!;
        break;
      case 'week':
        const weekStart = new Date(dateObj);
        weekStart.setDate(dateObj.getDate() - dateObj.getDay());
        key = weekStart.toISOString().split('T')[0]!;
        break;
      case 'month':
        key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        break;
    }
    
    grouped.set(key, (grouped.get(key) || 0) + value);
  });
  
  return Array.from(grouped.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(
  data: ChartDataPoint[],
  windowSize: number = 3
): ChartDataPoint[] {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = data.slice(start, index + 1);
    const average = window.reduce((sum, p) => sum + p.value, 0) / window.length;
    
    return {
      ...point,
      movingAverage: average,
    };
  });
}

/**
 * Format tooltip value
 */
export function formatTooltipValue(
  value: number,
  type: 'currency' | 'number' | 'percentage' = 'number'
): string {
  switch (type) {
    case 'currency':
      return `$${value.toFixed(2)}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString();
  }
}

/**
 * Get trend direction
 */
export function getTrendDirection(
  current: number,
  previous: number
): 'up' | 'down' | 'stable' {
  const threshold = 0.01; // 1% threshold for "stable"
  const change = (current - previous) / previous;
  
  if (Math.abs(change) < threshold) return 'stable';
  return change > 0 ? 'up' : 'down';
}

// Made with Bob
