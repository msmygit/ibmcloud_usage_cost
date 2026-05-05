/**
 * Resource Group Costs Page
 * Visualize spending across different resource groups with interactive graphs
 */

import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, DollarSign, TrendingUp, AlertCircle, Layers } from 'lucide-react';
import { CostCard } from '../components/ui/CostCard';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { CostDistributionChart } from '../components/charts/CostDistributionChart';
import { DataTable } from '../components/ui/DataTable';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { ExportButton } from '../components/ui/ExportButton';
import { useAccount } from '../contexts/AccountContext';
import { apiService } from '../services/api.service';
import { exportService } from '../services/export.service';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { format, subMonths, parseISO } from 'date-fns';
import type { UsageQueryParams } from '../types/api.types';
import type { ColumnDef } from '@tanstack/react-table';
import type { ExportFormat } from '../types/chart.types';

export function ResourceGroupCosts() {
  const { selectedAccount } = useAccount();
  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Refs for chart export
  const trendChartRef = useRef<HTMLDivElement>(null);
  const distributionChartRef = useRef<HTMLDivElement>(null);

  // Convert date range to month format
  const monthRange = useMemo(() => {
    const start = parseISO(dateRange.startDate);
    const end = parseISO(dateRange.endDate);
    return {
      startMonth: format(start, 'yyyy-MM'),
      endMonth: format(end, 'yyyy-MM'),
    };
  }, [dateRange]);

  // Fetch usage data
  const {
    data: usageData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['resource-group-costs', selectedAccount?.id, monthRange.startMonth, monthRange.endMonth],
    queryFn: () =>
      apiService.getUsage({
        accountId: selectedAccount!.id,
        startMonth: monthRange.startMonth,
        endMonth: monthRange.endMonth,
      } as UsageQueryParams),
    enabled: !!selectedAccount,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch resources to get resource group information
  const {
    data: resourcesData,
    isLoading: isLoadingResources,
  } = useQuery({
    queryKey: ['resources', selectedAccount?.id],
    queryFn: () => apiService.getResources({ accountId: selectedAccount!.id }),
    enabled: !!selectedAccount,
    staleTime: 5 * 60 * 1000,
  });

  // Process resource group cost data
  const resourceGroupData = useMemo(() => {
    if (!usageData?.resources || !resourcesData?.resources) return [];

    // Create a map of resource ID to resource group
    const resourceToGroupMap = new Map<string, { id: string; name: string }>();
    resourcesData.resources.forEach((resource: any) => {
      if (resource.id && resource.resource_group_id) {
        resourceToGroupMap.set(resource.id, {
          id: resource.resource_group_id,
          name: resource.resource_group_name || resource.resource_group_id,
        });
      }
    });

    // Group costs by resource group
    const groupMap = new Map<string, {
      id: string;
      name: string;
      totalCost: number;
      resourceCount: number;
      services: Set<string>;
      monthlyData: Map<string, number>;
    }>();

    usageData.resources.forEach((resource: any) => {
      const resourceGroup = resourceToGroupMap.get(resource.resource_id) || {
        id: 'unknown',
        name: 'Unknown Resource Group',
      };

      if (!groupMap.has(resourceGroup.id)) {
        groupMap.set(resourceGroup.id, {
          id: resourceGroup.id,
          name: resourceGroup.name,
          totalCost: 0,
          resourceCount: 0,
          services: new Set(),
          monthlyData: new Map(),
        });
      }

      const groupData = groupMap.get(resourceGroup.id)!;
      groupData.resourceCount++;
      groupData.services.add(resource.resource_name || 'Unknown');

      resource.usage?.forEach((u: any) => {
        const cost = u.cost || 0;
        groupData.totalCost += cost;
        const month = u.month || 'Unknown';
        groupData.monthlyData.set(month, (groupData.monthlyData.get(month) || 0) + cost);
      });
    });

    return Array.from(groupMap.values())
      .map(group => ({
        id: group.id,
        name: group.name,
        totalCost: group.totalCost,
        resourceCount: group.resourceCount,
        serviceCount: group.services.size,
        monthlyData: Array.from(group.monthlyData.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, value]) => ({ name, value })),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [usageData, resourcesData]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalCost = resourceGroupData.reduce((sum, group) => sum + group.totalCost, 0);
    const totalGroups = resourceGroupData.length;
    const totalResources = resourceGroupData.reduce((sum, group) => sum + group.resourceCount, 0);
    const avgCostPerGroup = totalGroups > 0 ? totalCost / totalGroups : 0;

    return {
      totalCost,
      totalGroups,
      totalResources,
      avgCostPerGroup,
    };
  }, [resourceGroupData]);

  // Prepare chart data
  const distributionData = useMemo(() => {
    const total = summaryMetrics.totalCost;
    return resourceGroupData.slice(0, 5).map(group => ({
      name: group.name,
      value: group.totalCost,
      percentage: total > 0 ? (group.totalCost / total) * 100 : 0,
    }));
  }, [resourceGroupData, summaryMetrics.totalCost]);

  // Aggregate monthly trend across all resource groups
  const trendData = useMemo(() => {
    const monthlyTotals = new Map<string, number>();
    
    resourceGroupData.forEach(group => {
      group.monthlyData.forEach(({ name, value }) => {
        monthlyTotals.set(name, (monthlyTotals.get(name) || 0) + value);
      });
    });

    return Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [resourceGroupData]);

  // Table columns
  const tableColumns: ColumnDef<typeof resourceGroupData[0]>[] = [
    {
      accessorKey: 'name',
      header: 'Resource Group',
      cell: (info) => (
        <div className="font-medium text-foreground">
          {info.getValue() as string}
        </div>
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
      accessorKey: 'serviceCount',
      header: 'Services',
      cell: (info) => formatNumber(info.getValue() as number),
    },
  ];

  // Export handlers
  const handleExportTrendChart = async (format: ExportFormat) => {
    if (!trendChartRef.current) return;
    
    const filename = exportService.generateFilename('resource-group-trend', format);
    
    if (format === 'png') {
      await exportService.exportChartAsPNG(trendChartRef.current, { filename });
    } else if (format === 'jpeg') {
      await exportService.exportChartAsJPEG(trendChartRef.current, { filename });
    }
  };

  const handleExportDistributionChart = async (format: ExportFormat) => {
    if (!distributionChartRef.current) return;
    
    const filename = exportService.generateFilename('resource-group-distribution', format);
    
    if (format === 'png') {
      await exportService.exportChartAsPNG(distributionChartRef.current, { filename });
    } else if (format === 'jpeg') {
      await exportService.exportChartAsJPEG(distributionChartRef.current, { filename });
    }
  };

  const handleExportData = async (format: ExportFormat) => {
    const filename = exportService.generateFilename('resource-group-costs', format);
    
    if (format === 'csv') {
      const csvData = resourceGroupData.map(group => ({
        'Resource Group': group.name,
        'Total Cost': group.totalCost,
        'Resource Count': group.resourceCount,
        'Service Count': group.serviceCount,
      }));
      exportService.exportAsCSV(csvData, filename);
    } else if (format === 'excel') {
      const excelData = {
        'Summary': [{
          'Total Cost': summaryMetrics.totalCost,
          'Total Groups': summaryMetrics.totalGroups,
          'Total Resources': summaryMetrics.totalResources,
          'Avg Cost/Group': summaryMetrics.avgCostPerGroup,
        }],
        'Resource Groups': resourceGroupData.map(group => ({
          'Resource Group': group.name,
          'Total Cost': group.totalCost,
          'Resource Count': group.resourceCount,
          'Service Count': group.serviceCount,
        })),
      };
      exportService.exportAsExcel(excelData, filename);
    } else if (format === 'json') {
      exportService.exportAsJSON({
        summary: summaryMetrics,
        resourceGroups: resourceGroupData,
        dateRange,
      }, filename);
    }
  };

  // Show message if no account is selected
  if (!selectedAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cost by Resource Group</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualize spending across different resource groups
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <div className="max-w-md mx-auto text-center">
            <Layers className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Select an Account
            </h2>
            <p className="text-sm text-muted-foreground">
              Please select an IBM Cloud account from the dropdown in the header to view resource group costs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cost by Resource Group</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualize spending across different resource groups
          </p>
        </div>
        <ExportButton
          onExport={handleExportData}
          formats={['csv', 'excel', 'json']}
        />
      </div>

      {/* Account Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Current Account</p>
            <p className="text-sm text-blue-900 dark:text-blue-100 font-mono">{selectedAccount.id}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {selectedAccount.resourceGroupCount} resource groups
            </p>
          </div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          maxMonths={12}
        />
      </div>

      {/* Loading State */}
      {(isLoading || isLoadingResources) && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" message="Loading resource group cost data..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Data</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {(error as any)?.message || 'Failed to load resource group cost data. Please try again.'}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isLoadingResources && !error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <CostCard
              title="Total Cost"
              value={summaryMetrics.totalCost}
              currency="USD"
              icon={<DollarSign className="h-6 w-6 text-blue-600" />}
            />
            <CostCard
              title="Resource Groups"
              value={summaryMetrics.totalGroups}
              currency=""
              icon={<Layers className="h-6 w-6 text-green-600" />}
            />
            <CostCard
              title="Total Resources"
              value={summaryMetrics.totalResources}
              currency=""
              icon={<Package className="h-6 w-6 text-purple-600" />}
            />
            <CostCard
              title="Avg Cost/Group"
              value={summaryMetrics.avgCostPerGroup}
              currency="USD"
              icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
            />
          </div>

          {/* Charts */}
          {resourceGroupData.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart */}
                {trendData.length > 0 && (
                  <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-foreground">Cost Trend</h2>
                      <ExportButton
                        onExport={handleExportTrendChart}
                        formats={['png', 'jpeg']}
                      />
                    </div>
                    <div ref={trendChartRef}>
                      <CostTrendChart
                        data={trendData}
                        config={{
                          title: '',
                          height: 350,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Distribution Chart */}
                {distributionData.length > 0 && (
                  <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-foreground">Top 5 Resource Groups</h2>
                      <ExportButton
                        onExport={handleExportDistributionChart}
                        formats={['png', 'jpeg']}
                      />
                    </div>
                    <div ref={distributionChartRef}>
                      <CostDistributionChart
                        data={distributionData}
                        config={{
                          title: '',
                          height: 350,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Group Table */}
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Resource Group Details
                </h2>
                <DataTable
                  data={resourceGroupData}
                  columns={tableColumns}
                  searchPlaceholder="Search resource groups..."
                  pageSize={20}
                />
              </div>
            </>
          ) : (
            <div className="bg-muted border border-border rounded-lg p-8 text-center">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No resource group cost data available for the selected period.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Made with Bob
