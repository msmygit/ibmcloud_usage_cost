import { z } from 'zod';

/**
 * Pagination query parameters schema
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  cursor: z.string().optional(),
});

/**
 * Sort query parameters schema
 */
export const SortQuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Resources query parameters schema
 */
export const ResourcesQuerySchema = z.object({
  accountId: z.string().optional().describe('IBM Cloud Account ID'),
  resourceGroupId: z.string().optional(),
  refresh: z.coerce.boolean().optional().default(false),
}).merge(PaginationQuerySchema).merge(SortQuerySchema);

/**
 * Usage query parameters schema
 */
export const UsageQuerySchema = z.object({
  accountId: z.string().optional().describe('IBM Cloud Account ID'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format').optional(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Start month must be in YYYY-MM format').optional(),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/, 'End month must be in YYYY-MM format').optional(),
}).refine(
  (data) => {
    // Either month OR (startMonth AND endMonth) must be provided
    const hasMonth = !!data.month;
    const hasRange = !!data.startMonth && !!data.endMonth;
    return hasMonth || hasRange;
  },
  {
    message: 'Either "month" or both "startMonth" and "endMonth" must be provided',
  },
);

/**
 * Report ID parameter schema
 */
export const ReportIdParamSchema = z.object({
  reportId: z.string().uuid('Report ID must be a valid UUID'),
});

/**
 * Account ID parameter schema
 */
export const AccountIdParamSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
});

// Type exports
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SortQuery = z.infer<typeof SortQuerySchema>;
export type ResourcesQuery = z.infer<typeof ResourcesQuerySchema>;
export type UsageQuery = z.infer<typeof UsageQuerySchema>;
export type ReportIdParam = z.infer<typeof ReportIdParamSchema>;
export type AccountIdParam = z.infer<typeof AccountIdParamSchema>;

// Made with Bob