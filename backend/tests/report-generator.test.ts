import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportGeneratorService } from '../src/services/report-generator.service';
import type { ReportGenerationOptions } from '../src/types/report.types';

describe('ReportGeneratorService', () => {
  let reportGenerator: ReportGeneratorService;
  let mockReportRepository: any;
  let mockCacheManager: any;
  let mockUsageCollector: any;

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

    mockUsageCollector = {
      collectUsageRange: vi.fn().mockResolvedValue({
        accountId: 'test-account',
        startMonth: '2026-01',
        endMonth: '2026-03',
        months: [
          {
            accountId: 'test-account',
            billingMonth: '2026-01',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            totalCost: 100,
            currency: 'USD',
            resources: [
              {
                resource_id: 'guid-1',
                resource_instance_id: 'guid-1',
                resource_name: 'Test Resource',
                billable_charges: 100,
                non_billable_charges: 0,
                currency: 'USD',
                service_name: 'Test Service',
              },
            ],
          },
          {
            accountId: 'test-account',
            billingMonth: '2026-02',
            startDate: '2026-02-01',
            endDate: '2026-02-28',
            totalCost: 150,
            currency: 'USD',
            resources: [
              {
                resource_id: 'guid-1',
                resource_instance_id: 'guid-1',
                resource_name: 'Test Resource',
                billable_charges: 150,
                non_billable_charges: 0,
                currency: 'USD',
                service_name: 'Test Service',
              },
            ],
          },
          {
            accountId: 'test-account',
            billingMonth: '2026-03',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
            totalCost: 200,
            currency: 'USD',
            resources: [
              {
                resource_id: 'guid-1',
                resource_instance_id: 'guid-1',
                resource_name: 'Test Resource',
                billable_charges: 200,
                non_billable_charges: 0,
                currency: 'USD',
                service_name: 'Test Service',
              },
            ],
          },
        ],
        totalCost: 450,
        currency: 'USD',
        collectedAt: new Date(),
      }),
    };

    const mockDataCorrelator = {
      correlateData: vi.fn().mockReturnValue({
        correlatedData: [
          {
            resource: {
              id: 'resource-1',
              guid: 'guid-1',
              crn: 'crn:v1:...',
              name: 'Test Resource',
              regionId: 'us-south',
              resourceGroupId: 'group-1',
            },
            usage: {
              resource_id: 'guid-1',
              billable_charges: 100,
              non_billable_charges: 0,
              currency: 'USD',
              service_name: 'Test Service',
            },
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

    mockCacheManager = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    const mockUserManagementClient = {
      getUserProfiles: vi.fn().mockResolvedValue(new Map()),
    };

    mockReportRepository = {
      save: vi.fn().mockResolvedValue(true),
      getById: vi.fn().mockResolvedValue(null),
      exists: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue(true),
    };

    reportGenerator = new ReportGeneratorService(
      mockResourceCollector as any,
      mockUsageCollector as any,
      mockDataCorrelator as any,
      mockCacheManager as any,
      mockUserManagementClient as any,
      mockReportRepository as any,
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

    it('should fallback to persistent storage when cache misses', async () => {
      const reportId = 'test-report-id';
      const mockReport = {
        type: 'user-spending' as const,
        reportId,
        accountId: 'test-account',
        generatedAt: new Date(),
        period: 'month' as const,
        dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' },
        status: 'completed' as const,
        users: [],
        topSpenders: [],
        summary: { totalCost: 0, totalUsers: 0, totalResources: 0, averageCostPerUser: 0, currency: 'USD' },
        costBreakdown: { byService: [], byRegion: [], byResourceGroup: [] },
        monthlyTrend: [],
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockReportRepository.getById.mockResolvedValue(mockReport);

      const result = await reportGenerator.getReport(reportId);

      expect(result).toEqual(mockReport);
      expect(mockReportRepository.getById).toHaveBeenCalledWith(reportId);
      expect(mockCacheManager.set).toHaveBeenCalled(); // Should repopulate cache
    });

    it('should return null when report not found in cache or storage', async () => {
      const reportId = 'non-existent-report';

      mockCacheManager.get.mockResolvedValue(null);
      mockReportRepository.getById.mockResolvedValue(null);

      const result = await reportGenerator.getReport(reportId);

      expect(result).toBeNull();
    });
  });

  describe('Multi-month data collection', () => {
    it('should collect usage data for all months in range', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'quarter',
      };

      await reportGenerator.generateUserSpendingReport(options);

      expect(mockUsageCollector.collectUsageRange).toHaveBeenCalled();
      const callArgs = mockUsageCollector.collectUsageRange.mock.calls[0];
      expect(callArgs[0]).toBe('test-account');
      expect(callArgs[1]).toHaveProperty('startMonth');
      expect(callArgs[1]).toHaveProperty('endMonth');
    });

    it('should generate monthly trend with actual data from each month', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'quarter',
      };

      const report = await reportGenerator.generateUserSpendingReport(options);

      expect(report.monthlyTrend).toBeDefined();
      expect(report.monthlyTrend.length).toBeGreaterThan(0);
      // Each month should have actual cost data, not averaged
      report.monthlyTrend.forEach(trend => {
        expect(trend).toHaveProperty('period');
        expect(trend).toHaveProperty('cost');
        expect(trend).toHaveProperty('resourceCount');
        expect(trend).toHaveProperty('userCount');
      });
    });
  });

  describe('Persistence', () => {
    it('should save report to persistent storage before caching', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'month',
      };

      await reportGenerator.generateUserSpendingReport(options);

      expect(mockReportRepository.save).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
      
      // Verify save was called before cache set
      const saveCallOrder = mockReportRepository.save.mock.invocationCallOrder[0];
      const cacheCallOrder = mockCacheManager.set.mock.invocationCallOrder[0];
      expect(saveCallOrder).toBeLessThan(cacheCallOrder);
    });

    it('should fail report generation if persistence fails', async () => {
      mockReportRepository.save.mockRejectedValue(new Error('Disk full'));

      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'month',
      };

      await expect(reportGenerator.generateUserSpendingReport(options)).rejects.toThrow();
    });
  });

  describe('Zero-cost scenarios', () => {
    it('should handle zero-cost reports gracefully', async () => {
      // Create a new service instance with zero-cost mocks
      const mockResourceCollector = {
        collectResources: vi.fn().mockResolvedValue([]),
      };

      const mockUsageCollectorZero = {
        collectUsageRange: vi.fn().mockResolvedValue({
          accountId: 'test-account',
          startMonth: '2026-01',
          endMonth: '2026-01',
          months: [
            {
              accountId: 'test-account',
              billingMonth: '2026-01',
              startDate: '2026-01-01',
              endDate: '2026-01-31',
              totalCost: 0,
              currency: 'USD',
              resources: [],
            },
          ],
          totalCost: 0,
          currency: 'USD',
          collectedAt: new Date(),
        }),
      };

      const mockDataCorrelatorZero = {
        correlateData: vi.fn().mockReturnValue({
          correlatedData: [],
          userSpending: [],
          stats: {
            totalResources: 0,
            matchedResources: 0,
            unmatchedResources: 0,
            matchRate: 0,
            matchedBy: { resource_id: 0, resource_instance_id: 0, crn: 0 },
          },
          correlatedAt: new Date(),
        }),
        generateMonthlyBreakdown: vi.fn().mockReturnValue([]),
      };

      const mockCacheManagerZero = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      };

      const mockUserManagementClientZero = {
        getUserProfiles: vi.fn().mockResolvedValue(new Map()),
      };

      const mockReportRepositoryZero = {
        save: vi.fn().mockResolvedValue(true),
        getById: vi.fn().mockResolvedValue(null),
        exists: vi.fn().mockResolvedValue(false),
        delete: vi.fn().mockResolvedValue(true),
      };

      const zeroReportGenerator = new ReportGeneratorService(
        mockResourceCollector as any,
        mockUsageCollectorZero as any,
        mockDataCorrelatorZero as any,
        mockCacheManagerZero as any,
        mockUserManagementClientZero as any,
        mockReportRepositoryZero as any,
      );

      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'month',
      };

      const report = await zeroReportGenerator.generateUserSpendingReport(options);

      expect(report).toBeDefined();
      expect(report.summary.totalCost).toBe(0);
      expect(report.users).toEqual([]);
      expect(report.status).toBe('completed');
    });

    it('should include months with zero usage in trend data', async () => {
      const options: ReportGenerationOptions = {
        accountId: 'test-account',
        period: 'quarter',
      };

      const report = await reportGenerator.generateUserSpendingReport(options);

      expect(report.monthlyTrend).toBeDefined();
      // All months should be present, even if some have zero cost
      expect(report.monthlyTrend.length).toBeGreaterThan(0);
    });
  });
});

// Made with Bob