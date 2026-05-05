import type { UserSpendingReport, TeamSpendingReport } from '../types/report.types';

/**
 * Report type union for storage
 */
export type StoredReport = UserSpendingReport | TeamSpendingReport;

/**
 * Metadata wrapper for stored reports
 */
export interface StoredReportMetadata {
  readonly reportId: string;
  readonly accountId: string;
  readonly type: 'user-spending' | 'team-spending';
  readonly generatedAt: string; // ISO 8601
  readonly storedAt: string; // ISO 8601
  readonly version: string; // Schema version for future migrations
  readonly report: StoredReport;
}

/**
 * Summary information for a stored report
 */
export interface ReportSummary {
  readonly reportId: string;
  readonly accountId: string;
  readonly type: 'user-spending' | 'team-spending';
  readonly generatedAt: string; // ISO 8601
  readonly storedAt: string; // ISO 8601
  readonly totalCost: number;
  readonly currency: string;
  readonly period: string;
  readonly dateRange: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Repository interface for report persistence
 */
export interface IReportRepository {
  /**
   * Save a report to persistent storage
   * @param report The report to save
   * @returns Promise resolving to true if successful
   * @throws Error if save fails
   */
  save(report: StoredReport): Promise<boolean>;

  /**
   * Retrieve a report by ID
   * @param reportId The report ID
   * @returns Promise resolving to the report or null if not found
   */
  getById(reportId: string): Promise<StoredReport | null>;

  /**
   * Check if a report exists
   * @param reportId The report ID
   * @returns Promise resolving to true if report exists
   */
  exists(reportId: string): Promise<boolean>;

  /**
   * Delete a report
   * @param reportId The report ID
   * @returns Promise resolving to true if deleted
   */
  delete(reportId: string): Promise<boolean>;

  /**
   * List all stored reports with summary information
   * @param accountId Optional account ID to filter by
   * @returns Promise resolving to array of report summaries
   */
  listAll(accountId?: string): Promise<ReportSummary[]>;
}

// Made with Bob