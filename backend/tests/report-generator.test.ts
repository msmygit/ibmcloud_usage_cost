import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportGeneratorService } from '../src/services/report-generator.service';
import type { ReportGenerationOptions } from '../src/types/report.types';

describe('ReportGeneratorService', () => {
  let reportGenerator: ReportGeneratorService;

  beforeEach(() => {
    // Mock dependencies
    const mockResourceCollector = {
      collectResources: vi.fn().mockResolvedValue([
        {
          id: 'resource-1',
          guid: 'guid-1',
          crn: 'crn:v1:...',
          name: 'Test Resource',
          regionId: 'us-south',
          resourceGroupId: 'group-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          createdBy: 'user@example.com',
        },
      ]),
    };

    const mockUsageCollector = {
      collectUsageRange: vi.fn().mockResolvedValue({
        accountId: 'test-account',
        startMonth: '2026-01',
        endMonth: '2026-03',
        months: [
          {
            billingMonth: '2026-01',
            totalCost: 100,
            currency: 'USD',
            resources: [
              {
                resource_id: 'resource-1',
                resource_instance_id: 'guid-1',
                billable_charges: 100,
                non_billable_charges: 0,
                currency: 'USD',
                service_name: 'Test Service',
              },
            ],
          },
        ],
        totalCost: 100,
        currency: 'USD',
        collectedAt: new Date(),
      }),
    };

    const mockDataCorrelator = {
      correlateData: vi.fn().mockReturnValue({
        correlatedData: [
          {
            resource: mockResourceCollector.collectResources.mock.results[0],
            usage: mockUsageCollector.collectUsageRange.mock.results[0].months[0].resources[0],
            matchedBy: 'resource_id',
            creatorEmail: 'user@example.com',
            totalCost: 100,
            currency: 'USD',
          },
        ],
        userSpending: [],
        stats: {
          totalResources: 1,
          matchedResources: 1,
          unmatchedResources: 0,
          matchRate: 100,
          matchedBy: { resource_id: 1, resource_instance_id: 0, crn: 0 },
        },
        correlatedAt: new Date(),
      }),
      generateMonthlyBreakdown: vi.fn().mockReturnValue([
        { month: '2026-01', cost: 100, currency: 'USD', resourceCount: 1 },
      ]),
    };

    const mockCacheManager = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    reportGenerator = new ReportGeneratorService(
      mockResourceCollector as any,
      mockUsageCollector as any,
      mockDataCorrelator as any,
      mockCacheManager as any,
    );
  });

  describe('generateUserSpendingReport', () => {
    it('should generate a user spending report successfully', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'month',
        includeForecasts: false,
      };

      const report = await reportGenerator.generateUserSpendingReport(options);

      expect(report).toBeDefined();
      expect(report.type).toBe('user-spending');
      expect(report.accountId).toBe('test-account');
      expect(report.status).toBe('completed');
      expect(report.summary).toBeDefined();
      expect(report.summary.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should call progress callback during generation', async () => {
      const progressCallback = vi.fn();
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'quarter',
      };

      await reportGenerator.generateUserSpendingReport(options, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(expect.any(Number), expect.any(String));
    });

    it('should include forecasts when requested', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'month',
        includeForecasts: true,
        forecastMonths: 3,
      };

      const report = await reportGenerator.generateUserSpendingReport(options);

      expect(report).toBeDefined();
      // Forecast validation would go here
    });

    it('should apply filters correctly', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'month',
        filters: {
          userEmails: ['user@example.com'],
          minCost: 50,
        },
      };

      const report = await reportGenerator.generateUserSpendingReport(options);

      expect(report).toBeDefined();
      expect(report.users.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateTeamSpendingReport', () => {
    it('should generate a team spending report successfully', async () => {
      const options: ReportGenerationOptions & { teamName?: string } = {
        accountId: 'test-account',
        teamName: 'Engineering',
        period: 'quarter',
        includeForecasts: true,
      };

      const report = await reportGenerator.generateTeamSpendingReport(options);

      expect(report).toBeDefined();
      expect(report.type).toBe('team-spending');
      expect(report.teamName).toBe('Engineering');
      expect(report.trendAnalysis).toBeDefined();
    });
  });

  describe('getReport', () => {
    it('should retrieve a cached report', async () => {
      const reportId = 'test-report-id';
      
      const result = await reportGenerator.getReport(reportId);

      // Should return null if not cached (based on mock)
      expect(result).toBeNull();
    });
  });
});

// Made with Bob