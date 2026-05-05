/**
 * Chart Types
 * Type definitions for chart components and configurations
 */

/**
 * Chart data point for line/area charts
 */
export interface ChartDataPoint {
  readonly name: string;
  readonly value: number;
  readonly [key: string]: string | number;
}

/**
 * Pie chart data point
 */
export interface PieChartDataPoint {
  readonly name: string;
  readonly value: number;
  readonly percentage?: number;
  readonly color?: string;
}

/**
 * Bar chart data point
 */
export interface BarChartDataPoint {
  readonly name: string;
  readonly [key: string]: string | number;
}

/**
 * Chart color scheme
 */
export type ChartColorScheme = 'default' | 'blue' | 'green' | 'purple' | 'orange';

/**
 * Chart configuration
 */
export interface ChartConfig {
  readonly title?: string;
  readonly subtitle?: string;
  readonly colorScheme?: ChartColorScheme;
  readonly showLegend?: boolean;
  readonly showGrid?: boolean;
  readonly showTooltip?: boolean;
  readonly height?: number;
  readonly width?: number | string;
  readonly responsive?: boolean;
}

/**
 * Line chart configuration
 */
export interface LineChartConfig extends ChartConfig {
  readonly dataKeys: string[];
  readonly xAxisKey: string;
  readonly showDots?: boolean;
  readonly strokeWidth?: number;
  readonly curved?: boolean;
}

/**
 * Bar chart configuration
 */
export interface BarChartConfig extends ChartConfig {
  readonly dataKeys: string[];
  readonly xAxisKey: string;
  readonly stacked?: boolean;
  readonly horizontal?: boolean;
}

/**
 * Pie chart configuration
 */
export interface PieChartConfig extends ChartConfig {
  readonly dataKey: string;
  readonly nameKey: string;
  readonly showLabels?: boolean;
  readonly innerRadius?: number;
  readonly outerRadius?: number;
}

/**
 * Area chart configuration
 */
export interface AreaChartConfig extends ChartConfig {
  readonly dataKeys: string[];
  readonly xAxisKey: string;
  readonly stacked?: boolean;
  readonly fillOpacity?: number;
}
/**
 * Export format types
 */
export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'csv' | 'excel' | 'json';


/**
 * Chart export options
 */
export interface ChartExportOptions {
  readonly format: 'png' | 'jpeg' | 'svg';
  readonly width?: number;
  readonly height?: number;
  readonly quality?: number;
  readonly backgroundColor?: string;
  readonly filename?: string;
}

/**
 * Chart tooltip data
 */
export interface ChartTooltipData {
  readonly label: string;
  readonly value: number | string;
  readonly color?: string;
  readonly payload?: Record<string, unknown>;
}

/**
 * Chart legend item
 */
export interface ChartLegendItem {
  readonly value: string;
  readonly color: string;
  readonly type?: 'line' | 'square' | 'circle';
}

/**
 * Chart axis configuration
 */
export interface ChartAxisConfig {
  readonly label?: string;
  readonly tickFormatter?: (value: number | string) => string;
  readonly domain?: [number | string, number | string];
  readonly ticks?: (number | string)[];
}

/**
 * Chart theme
 */
export interface ChartTheme {
  readonly colors: string[];
  readonly backgroundColor: string;
  readonly textColor: string;
  readonly gridColor: string;
  readonly tooltipBackground: string;
  readonly tooltipBorder: string;
}

// Made with Bob
