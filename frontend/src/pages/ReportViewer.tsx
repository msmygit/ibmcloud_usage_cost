/**
 * ReportViewer Page
 * Display generated reports with charts, tables, and export functionality
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, Calendar, DollarSign, Users, Package } from 'lucide-react';
import { useReport, useDownloadReport } from '../hooks/useReports';
import { useChartExport, useDataExport } from '../hooks/useExport';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { CostDistributionChart } from '../components/charts/CostDistributionChart';
import { UserComparisonChart } from '../components/charts/UserComparisonChart';
import { CumulativeCostChart } from '../components/charts/CumulativeCostChart';
import { DataTable } from '../components/ui/DataTable';
import { ExportButton } from '../components/ui/ExportButton';
import { CostCard } from '../components/ui/CostCard';
import {
  transformUserSpendingForPieChart,
  transformServiceBreakdownForPieChart,
  transformMonthlyTrendForLineChart,
  transformUserSpendingForBarChart,
} from '../utils/chart-helpers';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import type { UserSpendingReport, TeamSpendingReport } from '../types/report.types';
import type { ColumnDef } from '@tanstack/react-table';

export function ReportViewer() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { mutate: downloadReport } = useDownloadReport();
  const { exportAsPNG } = useChartExport();
  const { exportAsCSV, exportAsJSON } = useDataExport();

  // Fetch report data
  const { data: report, isLoading, error } = useReport(reportId || '', {
    enabled: !!reportId,
  });

  // Handle export
  const handleExportReport = async (format: 'json' | 'csv' | 'pdf' | 'excel' | 'png' | 'jpeg') => {
    // Only handle report formats, not chart formats
    if (format === 'png' || format === 'jpeg') return;
    if (!reportId) return;
    
    if (format === 'json' && report) {
      exportAsJSON(report, `report-${reportId}`);
    } else if (format === 'csv' && report) {
      // Export as CSV based on report type
      if (report.type === 'user-spending') {
        const userReport = report as UserSpendingReport;
        exportAsCSV(userReport.topSpenders as any, `report-${reportId}`);
      } else if (report.type === 'team-spending') {
        const teamReport = report as TeamSpendingReport;
        exportAsCSV(teamReport.topUsers as any, `report-${reportId}`);
      }
    } else {
      // Use backend download for PDF/Excel
      downloadReport({ reportId, format });
    }
  };

  const handleExportChart = async (chartId: string, format: 'png' | 'jpeg') => {
    const element = document.getElementById(chartId);
    if (!element) return;
    
    await exportAsPNG(element, { filename: `${chartId}-${Date.now()}` });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading report..." />
      </div>
    );
  }

  // Error state
  if (error || !report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/reports')}
            className="mr-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-3xl font-bold text-foreground">Report Not Found</h1>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <p className="text-red-800 dark:text-red-200">
            {error ? (error as any).message : 'The requested report could not be found.'}
          </p>
          <button
            onClick={() => navigate('/reports/generate')}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Generate New Report
          </button>
        </div>
      </div>
    );
  }

  // Render based on report type
  const isUserSpendingReport = report.type === 'user-spending';
  const isTeamSpendingReport = report.type === 'team-spending';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/reports')}
            className="mr-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isUserSpendingReport && 'User Spending Report'}
              {isTeamSpendingReport && 'Team Spending Report'}
              {!isUserSpendingReport && !isTeamSpendingReport && 'Report'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generated on {formatDate(report.generatedAt)}
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex space-x-2">
          <ExportButton
            onExport={handleExportReport}
            formats={['json', 'csv', 'excel', 'pdf']}
          />
        </div>
      </div>

      {/* Report Metadata */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Report Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Report ID</dt>
            <dd className="text-sm font-mono text-foreground mt-1">{report.reportId}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Account ID</dt>
            <dd className="text-sm font-mono text-foreground mt-1">{report.accountId}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Period</dt>
            <dd className="text-sm text-foreground mt-1 capitalize">{report.period}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Date Range</dt>
            <dd className="text-sm text-foreground mt-1">
              {formatDate(report.dateRange.startDate)} - {formatDate(report.dateRange.endDate)}
            </dd>
          </div>
        </dl>

        {/* Applied Filters */}
        {report.filters && Object.keys(report.filters).length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-2">Applied Filters</h3>
            <div className="flex flex-wrap gap-2">
              {report.filters.userEmails && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  Users: {report.filters.userEmails.length}
                </span>
              )}
              {report.filters.serviceNames && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Services: {report.filters.serviceNames.length}
                </span>
              )}
              {report.filters.minCost !== undefined && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  Min Cost: {formatCurrency(report.filters.minCost)}
                </span>
              )}
              {report.filters.maxCost !== undefined && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  Max Cost: {formatCurrency(report.filters.maxCost)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Spending Report */}
      {isUserSpendingReport && (
        <UserSpendingReportView report={report as UserSpendingReport} onExportChart={handleExportChart} />
      )}

      {/* Team Spending Report */}
      {isTeamSpendingReport && (
        <TeamSpendingReportView report={report as TeamSpendingReport} onExportChart={handleExportChart} />
      )}
    </div>
  );
}

// User Spending Report View Component
function UserSpendingReportView({
  report,
  onExportChart,
}: {
  report: UserSpendingReport;
  onExportChart: (chartId: string, format: 'png' | 'jpeg') => Promise<void>;
}) {
  // Transform data for charts
  const distributionData = transformUserSpendingForPieChart(report);
  const trendData = transformMonthlyTrendForLineChart(report.monthlyTrend);
  const comparisonData = transformUserSpendingForBarChart(report, 10);
  const serviceDistribution = transformServiceBreakdownForPieChart(report);

  // Helper function to format user display name
  const formatUserName = (user: typeof report.topSpenders[0]) => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return fullName || user.userEmail;
  };

  // Prepare table columns using TanStack Table format
  const tableColumns: ColumnDef<typeof report.topSpenders[0]>[] = [
    {
      id: 'user',
      header: 'Creator',
      cell: (info) => {
        const user = info.row.original;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        return (
          <div className="min-w-[220px]">
            <div className="font-medium text-foreground">{fullName || user.userEmail || user.iamId || 'Unknown'}</div>
            {user.userEmail && <div className="text-sm text-muted-foreground">{user.userEmail}</div>}
            {user.iamId && <div className="text-xs text-muted-foreground">IAM ID: {user.iamId}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: 'firstName',
      header: 'First name',
      cell: (info) => (info.getValue() as string | undefined) || '—',
    },
    {
      accessorKey: 'lastName',
      header: 'Last name',
      cell: (info) => (info.getValue() as string | undefined) || '—',
    },
    {
      accessorKey: 'userEmail',
      header: 'Email',
      cell: (info) => (
        <span className="font-mono text-xs text-foreground">
          {(info.getValue() as string | undefined) || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'totalCost',
      header: 'Total Cost',
      cell: (info) => formatCurrency(info.getValue() as number),
    },
    {
      accessorKey: 'resourceCount',
      header: 'Resources',
      cell: (info) => formatNumber(info.getValue() as number),
    },
    {
      accessorKey: 'percentage',
      header: 'Percentage',
      cell: (info) => {
        const value = info.getValue() as number | null | undefined;
        return `${(value ?? 0).toFixed(1)}%`;
      },
    },
  ];

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CostCard
          title="Total Cost"
          value={report.summary.totalCost}
          currency={report.summary.currency}
          icon={<DollarSign className="h-6 w-6 text-blue-600" />}
        />
        <CostCard
          title="Total Users"
          value={report.summary.totalUsers}
          currency=""
          icon={<Users className="h-6 w-6 text-green-600" />}
        />
        <CostCard
          title="Total Resources"
          value={report.summary.totalResources}
          currency=""
          icon={<Package className="h-6 w-6 text-purple-600" />}
        />
        <CostCard
          title="Avg Cost/User"
          value={report.summary.averageCostPerUser}
          currency={report.summary.currency}
          icon={<Users className="h-6 w-6 text-orange-600" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div id="cost-trend-chart">
            <CostTrendChart
              data={trendData}
              config={{
                title: 'Monthly Cost Trend',
                height: 350,
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <ExportButton
              onExport={async (format) => await onExportChart('cost-trend-chart', format as 'png' | 'jpeg')}
              formats={['png', 'jpeg']}
            />
          </div>
        </div>

        <div>
          <div id="user-distribution-chart">
            <CostDistributionChart
              data={distributionData}
              config={{
                title: 'Top Spenders Distribution',
                height: 350,
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <ExportButton
              onExport={async (format) => await onExportChart('user-distribution-chart', format as 'png' | 'jpeg')}
              formats={['png', 'jpeg']}
            />
          </div>
        </div>

        <div>
          <div id="user-comparison-chart">
            <UserComparisonChart
              data={comparisonData}
              config={{
                title: 'User Cost Comparison',
                height: 350,
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <ExportButton
              onExport={async (format) => await onExportChart('user-comparison-chart', format as 'png' | 'jpeg')}
              formats={['png', 'jpeg']}
            />
          </div>
        </div>

        <div>
          <div id="service-distribution-chart">
            <CostDistributionChart
              data={serviceDistribution}
              config={{
                title: 'Cost by Service',
                height: 350,
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <ExportButton
              onExport={async (format) => await onExportChart('service-distribution-chart', format as 'png' | 'jpeg')}
              formats={['png', 'jpeg']}
            />
          </div>
        </div>
      </div>

      {/* Cumulative Cost Chart */}
      <div>
        <div id="cumulative-cost-chart">
          <CumulativeCostChart
            data={trendData}
            config={{
              title: 'Cumulative Cost Over Time',
              height: 300,
            }}
          />
        </div>
        <div className="mt-2 flex justify-end">
          <ExportButton
            onExport={async (format) => await onExportChart('cumulative-cost-chart', format as 'png' | 'jpeg')}
            formats={['png', 'jpeg']}
          />
        </div>
      </div>

      {/* Cost by Creator Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Cost by Creator</h2>
        <DataTable
          data={report.topSpenders}
          columns={tableColumns}
          searchPlaceholder="Search creators..."
        />
      </div>
    </>
  );
}

// Team Spending Report View Component
function TeamSpendingReportView({
  report,
  onExportChart,
}: {
  report: TeamSpendingReport;
  onExportChart: (chartId: string, format: 'png' | 'jpeg') => Promise<void>;
}) {
  // Transform data for charts
  const trendData = transformMonthlyTrendForLineChart(report.trendAnalysis.historical);
  const serviceDistribution = transformServiceBreakdownForPieChart(report);

  // Table columns
  const serviceColumns: ColumnDef<typeof report.topServices[0]>[] = [
    {
      accessorKey: 'serviceName',
      header: 'Service',
      cell: (info) => info.getValue(),
    },
    {
      accessorKey: 'cost',
      header: 'Cost',
      cell: (info) => formatCurrency(info.getValue() as number),
    },
    {
      accessorKey: 'percentage',
      header: 'Percentage',
      cell: (info) => {
        const value = info.getValue() as number | null | undefined;
        return `${(value ?? 0).toFixed(1)}%`;
      },
    },
  ];

  const userColumns: ColumnDef<typeof report.topUsers[0]>[] = [
    {
      accessorKey: 'userEmail',
      header: 'User',
      cell: (info) => info.getValue(),
    },
    {
      accessorKey: 'cost',
      header: 'Cost',
      cell: (info) => formatCurrency(info.getValue() as number),
    },
    {
      accessorKey: 'percentage',
      header: 'Percentage',
      cell: (info) => {
        const value = info.getValue() as number | null | undefined;
        return `${(value ?? 0).toFixed(1)}%`;
      },
    },
  ];

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CostCard
          title="Total Cost"
          value={report.totalCost}
          currency={report.currency}
          icon={<DollarSign className="h-6 w-6 text-blue-600" />}
        />
        <CostCard
          title="User Count"
          value={report.userCount}
          currency=""
          icon={<Users className="h-6 w-6 text-green-600" />}
        />
        <CostCard
          title="Resource Count"
          value={report.resourceCount}
          currency=""
          icon={<Package className="h-6 w-6 text-purple-600" />}
        />
        <CostCard
          title="Avg Monthly Cost"
          value={report.trendAnalysis.averageMonthlyCost}
          currency={report.currency}
          icon={<Calendar className="h-6 w-6 text-orange-600" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div id="team-trend-chart">
            <CostTrendChart
              data={trendData}
              config={{
                title: 'Team Cost Trend',
                height: 350,
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <ExportButton
              onExport={async (format) => await onExportChart('team-trend-chart', format as 'png' | 'jpeg')}
              formats={['png', 'jpeg']}
            />
          </div>
        </div>

        <div>
          <div id="team-service-distribution">
            <CostDistributionChart
              data={serviceDistribution}
              config={{
                title: 'Cost by Service',
                height: 350,
              }}
            />
          </div>
          <div className="mt-2 flex justify-end">
            <ExportButton
              onExport={async (format) => await onExportChart('team-service-distribution', format as 'png' | 'jpeg')}
              formats={['png', 'jpeg']}
            />
          </div>
        </div>
      </div>

      {/* Top Services Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Top Services</h2>
        <DataTable
          data={report.topServices}
          columns={serviceColumns}
        />
      </div>

      {/* Top Users Table */}
      <div className="bg-background rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Top Users</h2>
        <DataTable
          data={report.topUsers}
          columns={userColumns}
        />
      </div>
    </>
  );
}

// Made with Bob
