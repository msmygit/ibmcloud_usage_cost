import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import type { IReportRepository, StoredReport, StoredReportMetadata } from './report.repository';

/**
 * File-based implementation of the report repository
 * Stores reports as JSON files in .data/reports/<accountId>/<reportId>.json
 */
export class FileReportRepository implements IReportRepository {
  private readonly baseDir: string;
  private readonly version = '1.0.0';

  constructor(baseDir: string = '.data/reports') {
    this.baseDir = baseDir;
  }

  /**
   * Get the file path for a report
   */
  private getReportPath(accountId: string, reportId: string): string {
    return path.join(this.baseDir, accountId, `${reportId}.json`);
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create directory', { dirPath, error });
      throw new Error(`Failed to create directory: ${dirPath}`);
    }
  }

  /**
   * Save a report to persistent storage
   */
  async save(report: StoredReport): Promise<boolean> {
    try {
      const accountDir = path.join(this.baseDir, report.accountId);
      await this.ensureDirectory(accountDir);

      const metadata: StoredReportMetadata = {
        reportId: report.reportId,
        accountId: report.accountId,
        type: report.type,
        generatedAt: report.generatedAt.toISOString(),
        storedAt: new Date().toISOString(),
        version: this.version,
        report,
      };

      const filePath = this.getReportPath(report.accountId, report.reportId);
      const content = JSON.stringify(metadata, null, 2);

      await fs.writeFile(filePath, content, 'utf-8');

      logger.info('Report saved to filesystem', {
        reportId: report.reportId,
        accountId: report.accountId,
        type: report.type,
        filePath,
      });

      return true;
    } catch (error) {
      logger.error('Failed to save report to filesystem', {
        reportId: report.reportId,
        accountId: report.accountId,
        error,
      });
      throw new Error(`Failed to save report ${report.reportId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a report by ID
   */
  async getById(reportId: string): Promise<StoredReport | null> {
    try {
      // We need to search through account directories since we don't know the accountId
      const accountDirs = await this.getAccountDirectories();

      for (const accountId of accountDirs) {
        const filePath = this.getReportPath(accountId, reportId);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const metadata: StoredReportMetadata = JSON.parse(content);

          // Convert ISO strings back to Date objects
          const report = {
            ...metadata.report,
            generatedAt: new Date(metadata.report.generatedAt),
          };

          logger.info('Report retrieved from filesystem', {
            reportId,
            accountId,
            filePath,
          });

          return report as StoredReport;
        } catch (error) {
          // File doesn't exist in this account directory, continue searching
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn('Error reading report file', { filePath, error });
          }
        }
      }

      logger.debug('Report not found in filesystem', { reportId });
      return null;
    } catch (error) {
      logger.error('Failed to retrieve report from filesystem', {
        reportId,
        error,
      });
      return null;
    }
  }

  /**
   * Check if a report exists
   */
  async exists(reportId: string): Promise<boolean> {
    try {
      const accountDirs = await this.getAccountDirectories();

      for (const accountId of accountDirs) {
        const filePath = this.getReportPath(accountId, reportId);
        
        try {
          await fs.access(filePath);
          return true;
        } catch {
          // File doesn't exist in this account directory, continue searching
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check report existence', { reportId, error });
      return false;
    }
  }

  /**
   * Delete a report
   */
  async delete(reportId: string): Promise<boolean> {
    try {
      const accountDirs = await this.getAccountDirectories();

      for (const accountId of accountDirs) {
        const filePath = this.getReportPath(accountId, reportId);
        
        try {
          await fs.unlink(filePath);
          logger.info('Report deleted from filesystem', {
            reportId,
            accountId,
            filePath,
          });
          return true;
        } catch (error) {
          // File doesn't exist in this account directory, continue searching
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn('Error deleting report file', { filePath, error });
          }
        }
      }

      logger.debug('Report not found for deletion', { reportId });
      return false;
    } catch (error) {
      logger.error('Failed to delete report from filesystem', {
        reportId,
        error,
      });
      return false;
    }
  }

  /**
   * List all stored reports with summary information
   */
  async listAll(accountId?: string): Promise<import('./report.repository').ReportSummary[]> {
    try {
      const summaries: import('./report.repository').ReportSummary[] = [];
      
      // Get account directories to search
      const accountDirs = accountId
        ? [accountId]
        : await this.getAccountDirectories();

      for (const accId of accountDirs) {
        const accountDir = path.join(this.baseDir, accId);
        
        try {
          const files = await fs.readdir(accountDir);
          
          for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(accountDir, file);
            
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              const metadata: import('./report.repository').StoredReportMetadata = JSON.parse(content);
              
              // Extract summary information
              const report = metadata.report;
              const summary: import('./report.repository').ReportSummary = {
                reportId: metadata.reportId,
                accountId: metadata.accountId,
                type: metadata.type,
                generatedAt: metadata.generatedAt,
                storedAt: metadata.storedAt,
                totalCost: report.type === 'user-spending'
                  ? report.summary.totalCost
                  : report.totalCost,
                currency: report.type === 'user-spending'
                  ? report.summary.currency
                  : report.currency,
                period: report.period,
                dateRange: report.dateRange,
              };
              
              summaries.push(summary);
            } catch (error) {
              logger.warn('Failed to read report file', { filePath, error });
            }
          }
        } catch (error) {
          // Account directory doesn't exist or can't be read
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.warn('Error reading account directory', { accountDir, error });
          }
        }
      }

      // Sort by generatedAt descending (newest first)
      summaries.sort((a, b) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );

      logger.info('Listed reports', {
        count: summaries.length,
        accountId: accountId || 'all'
      });

      return summaries;
    } catch (error) {
      logger.error('Failed to list reports', { accountId, error });
      return [];
    }
  }

  /**
   * Get list of account directories
   */
  private async getAccountDirectories(): Promise<string[]> {
    try {
      await this.ensureDirectory(this.baseDir);
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      logger.error('Failed to read account directories', { error });
      return [];
    }
  }
}

// Made with Bob