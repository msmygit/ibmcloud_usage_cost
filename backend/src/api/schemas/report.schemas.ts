import { z } from 'zod';

/**
 * Time period enum
 */
export const TimePeriodSchema = z.enum(['month', 'quarter', 'year', 'custom']);

/**
 * Date range schema
 */
export const DateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * Report filters schema
 */
export const ReportFiltersSchema = z.object({
  userEmails: z.array(z.string().email()).optional(),
  serviceNames: z.array(z.string()).optional(),
  resourceGroups: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  minCost: z.number().min(0).optional(),
  maxCost: z.number().min(0).optional(),
}).optional();

/**
 * Generate user spending report request schema
 */
export const GenerateUserSpendingRequestSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  period: TimePeriodSchema,
  dateRange: DateRangeSchema.optional(),
  filters: ReportFiltersSchema,
  includeForecasts: z.boolean().optional().default(false),
  forecastMonths: z.number().int().min(1).max(12).optional().default(3),
}).refine(
  (data) => {
    // If period is custom, dateRange is required
    if (data.period === 'custom' && !data.dateRange) {
      return false;
    }
    return true;
  },
  {
    message: 'dateRange is required when period is "custom"',
    path: ['dateRange'],
  },
);

/**
 * Generate team spending report request schema
 */
export const GenerateTeamSpendingRequestSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  teamName: z.string().optional(),
  period: TimePeriodSchema,
  dateRange: DateRangeSchema.optional(),
  filters: ReportFiltersSchema,
  includeForecasts: z.boolean().optional().default(true),
  forecastMonths: z.number().int().min(1).max(12).optional().default(3),
}).refine(
  (data) => {
    if (data.period === 'custom' && !data.dateRange) {
      return false;
    }
    return true;
  },
  {
    message: 'dateRange is required when period is "custom"',
    path: ['dateRange'],
  },
);

/**
 * Report export format schema
 */
export const ReportExportFormatSchema = z.enum(['json', 'csv', 'pdf', 'excel', 'pptx']);

/**
 * Export report request schema
 */
export const ExportReportRequestSchema = z.object({
  format: ReportExportFormatSchema,
  includeCharts: z.boolean().optional().default(false),
  includeRawData: z.boolean().optional().default(false),
});

// Type exports for use in controllers
export type GenerateUserSpendingRequest = z.infer<typeof GenerateUserSpendingRequestSchema>;
export type GenerateTeamSpendingRequest = z.infer<typeof GenerateTeamSpendingRequestSchema>;
export type ExportReportRequest = z.infer<typeof ExportReportRequestSchema>;

// Made with Bob