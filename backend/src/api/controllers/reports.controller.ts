import type { Request, Response, NextFunction } from 'express';
import { reportGeneratorService } from '../../services/report-generator.service';
import type {
  GenerateUserSpendingRequest,
  GenerateTeamSpendingRequest,
} from '../schemas/report.schemas';
import type {
  GenerateReportResponse,
  GetReportResponse,
  ApiResponse,
} from '../../types/api.types';
import type {
  ReportProgressPayload,
  ReportCompletePayload,
  ReportErrorPayload,
} from '../../types/websocket.types';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/error-handler';

/**
 * Reports controller for handling report generation and retrieval
 */
export class ReportsController {
  private progressHandler?: any; // Will be set by the server

  /**
   * Sets the progress handler for WebSocket updates
   */
  public setProgressHandler(handler: any): void {
    this.progressHandler = handler;
  }

  /**
   * Generates a user spending report
   */
  public async generateUserSpendingReport(
    req: Request<{}, {}, GenerateUserSpendingRequest>,
    res: Response<ApiResponse<GenerateReportResponse>>,
    next: NextFunction,
  ): Promise<void> {
    const requestId = res.locals.requestId as string;
    const reportId = crypto.randomUUID();

    try {
      logger.info({ requestId, reportId, body: req.body }, 'Generating user spending report');

      // Register report with progress handler
      if (this.progressHandler) {
        this.progressHandler.registerReport(reportId, requestId);
      }

      // Start report generation asynchronously
      this.generateUserReportAsync(reportId, req.body, requestId).catch((error) => {
        logger.error({ requestId, reportId, error }, 'Async report generation failed');
      });

      // Return immediate response
      const response: ApiResponse<GenerateReportResponse> = {
        success: true,
        data: {
          reportId,
          status: 'processing',
          estimatedTime: 30, // seconds
          websocketRoom: `report:${reportId}`,
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generates a team spending report
   */
  public async generateTeamSpendingReport(
    req: Request<{}, {}, GenerateTeamSpendingRequest>,
    res: Response<ApiResponse<GenerateReportResponse>>,
    next: NextFunction,
  ): Promise<void> {
    const requestId = res.locals.requestId as string;
    const reportId = crypto.randomUUID();

    try {
      logger.info({ requestId, reportId, body: req.body }, 'Generating team spending report');

      // Register report with progress handler
      if (this.progressHandler) {
        this.progressHandler.registerReport(reportId, requestId);
      }

      // Start report generation asynchronously
      this.generateTeamReportAsync(reportId, req.body, requestId).catch((error) => {
        logger.error({ requestId, reportId, error }, 'Async report generation failed');
      });

      // Return immediate response
      const response: ApiResponse<GenerateReportResponse> = {
        success: true,
        data: {
          reportId,
          status: 'processing',
          estimatedTime: 35, // seconds
          websocketRoom: `report:${reportId}`,
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Gets a generated report by ID
   */
  public async getReport(
    req: Request<{ reportId: string }>,
    res: Response<ApiResponse<GetReportResponse>>,
    next: NextFunction,
  ): Promise<void> {
    const requestId = res.locals.requestId as string;
    const { reportId } = req.params;

    try {
      logger.info({ requestId, reportId }, 'Retrieving report');

      const report = await reportGeneratorService.getReport(reportId);

      if (!report) {
        throw new AppError(
          'Report not found',
          'REPORT_NOT_FOUND',
          404,
          { operation: 'getReport' },
        );
      }

      const response: ApiResponse<GetReportResponse> = {
        success: true,
        data: {
          report,
          status: 'completed',
          cachedAt: report.generatedAt.toISOString(),
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Downloads a report in specified format
   */
  public async downloadReport(
    req: Request<{ reportId: string }, {}, {}, { format?: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const requestId = res.locals.requestId as string;
    const { reportId } = req.params;
    const format = req.query.format || 'json';

    try {
      logger.info({ requestId, reportId, format }, 'Downloading report');

      const report = await reportGeneratorService.getReport(reportId);

      if (!report) {
        throw new AppError(
          'Report not found',
          'REPORT_NOT_FOUND',
          404,
          { operation: 'downloadReport' },
        );
      }

      // Set appropriate headers based on format
      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.json"`);
          res.status(200).json(report);
          break;

        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.csv"`);
          const csv = this.convertToCSV(report);
          res.status(200).send(csv);
          break;

        default:
          throw new AppError(
            `Unsupported format: ${format}`,
            'UNSUPPORTED_FORMAT',
            400,
            { operation: 'downloadReport', details: { format } },
          );
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Async method to generate user spending report with progress updates
   */
  private async generateUserReportAsync(
    reportId: string,
    options: GenerateUserSpendingRequest,
    requestId: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Progress callback
      const progressCallback = (progress: number, step: string) => {
        if (this.progressHandler) {
          const payload: ReportProgressPayload = {
            reportId,
            status: 'processing',
            progress,
            currentStep: step as any,
            estimatedTimeRemaining: Math.max(0, 30 - Math.floor((Date.now() - startTime) / 1000)),
            timestamp: new Date().toISOString(),
          };
          this.progressHandler.emitProgress(payload);
        }
      };

      // Generate report
      const report = await reportGeneratorService.generateUserSpendingReport(
        options,
        progressCallback,
        reportId,
      );

      // Emit completion
      if (this.progressHandler) {
        const payload: ReportCompletePayload = {
          reportId,
          status: 'completed',
          message: 'User spending report generated successfully',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          reportUrl: `/api/reports/${reportId}`,
        };
        this.progressHandler.emitComplete(payload);
      }

      logger.info({ requestId, reportId, duration: Date.now() - startTime }, 'Report generated');
    } catch (error) {
      logger.error({ requestId, reportId, error }, 'Report generation failed');

      // Emit error
      if (this.progressHandler) {
        const payload: ReportErrorPayload = {
          reportId,
          status: 'failed',
          error: {
            code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          },
          timestamp: new Date().toISOString(),
        };
        this.progressHandler.emitError(payload);
      }
    }
  }

  /**
   * Async method to generate team spending report with progress updates
   */
  private async generateTeamReportAsync(
    reportId: string,
    options: GenerateTeamSpendingRequest,
    requestId: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Progress callback
      const progressCallback = (progress: number, step: string) => {
        if (this.progressHandler) {
          const payload: ReportProgressPayload = {
            reportId,
            status: 'processing',
            progress,
            currentStep: step as any,
            estimatedTimeRemaining: Math.max(0, 35 - Math.floor((Date.now() - startTime) / 1000)),
            timestamp: new Date().toISOString(),
          };
          this.progressHandler.emitProgress(payload);
        }
      };

      // Generate report
      const report = await reportGeneratorService.generateTeamSpendingReport(
        options,
        progressCallback,
        reportId,
      );

      // Emit completion
      if (this.progressHandler) {
        const payload: ReportCompletePayload = {
          reportId,
          status: 'completed',
          message: 'Team spending report generated successfully',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          reportUrl: `/api/reports/${reportId}`,
        };
        this.progressHandler.emitComplete(payload);
      }

      logger.info({ requestId, reportId, duration: Date.now() - startTime }, 'Report generated');
    } catch (error) {
      logger.error({ requestId, reportId, error }, 'Report generation failed');

      // Emit error
      if (this.progressHandler) {
        const payload: ReportErrorPayload = {
          reportId,
          status: 'failed',
          error: {
            code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          },
          timestamp: new Date().toISOString(),
        };
        this.progressHandler.emitError(payload);
      }
    }
  }

  /**
   * Converts report to CSV format
   */
  private convertToCSV(report: any): string {
    const lines: string[] = [];

    // Add header
    lines.push('User Email,Total Cost,Resource Count,Currency');

    // Add user data
    if (report.type === 'user-spending') {
      for (const user of report.users) {
        lines.push(
          `${user.userEmail},${user.totalCost},${user.resourceCount},${user.currency}`,
        );
      }
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const reportsController = new ReportsController();

// Made with Bob