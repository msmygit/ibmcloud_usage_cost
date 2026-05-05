/**
 * Dashboard Page
 * Simple single-page view: Account Cost → Resources by Creator → Resources by Resource Group
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Users, Layers, Package, AlertCircle, Calendar } from 'lucide-react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DataTable } from '../components/ui/DataTable';
import { CostDistributionChart } from '../components/charts/CostDistributionChart';
import { useAccount } from '../contexts/AccountContext';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { format } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import type { AccountSummaryResponse } from '../types/api.types';
import type { PieChartDataPoint } from '../types/chart.types';

export function Dashboard() {
  const { selectedAccount } = useAccount();
  const [dateRange, setDateRange] = useState<'current' | 'last-month' | 'last-3' | 'last-6' | 'last-12' | 'custom'>('current');
  const [customMonth, setCustomMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  // Calculate the month to display based on selection
  const selectedMonth = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'current':
        return format(now, 'yyyy-MM');
      case 'last-month':
        now.setMonth(now.getMonth() - 1);
        return format(now, 'yyyy-MM');
      case 'last-3':
        now.setMonth(now.getMonth() - 2);
        return format(now, 'yyyy-MM');
      case 'last-6':
        now.setMonth(now.getMonth() - 5);
        return format(now, 'yyyy-MM');
      case 'last-12':
        now.setMonth(now.getMonth() - 11);
        return format(now, 'yyyy-MM');
      case 'custom':
        return customMonth;
      default:
        return format(new Date(), 'yyyy-MM');
    }
  }, [dateRange, customMonth]);

  // Fetch enriched account summary (combines usage costs + resources + creator profiles)
  const { data: accountSummary, isLoading, error } = useQuery<AccountSummaryResponse>({
    queryKey: ['account-summary', selectedAccount?.id, selectedMonth],
    queryFn: async () => {
      const response = await fetch(
        `/api/usage/account-summary?accountId=${selectedAccount!.id}&month=${selectedMonth}`
      );
      if (!response.ok) throw new Error('Failed to fetch account summary');
      const data = await response.json();
      
      // DEBUG: Log first resource instance received from backend
      if (data.resourceInstances && data.resourceInstances.length > 0) {
        console.log('[DEBUG] First resource instance received from backend:', {
          name: data.resourceInstances[0].name,
          guid: data.resourceInstances[0].guid,
          createdBy: data.resourceInstances[0].createdBy,
          created_by: data.resourceInstances[0].created_by,
          creatorProfile: data.resourceInstances[0].creatorProfile,
          resourceGroupId: data.resourceInstances[0].resourceGroupId,
          resourceGroupName: data.resourceInstances[0].resourceGroupName,
        });
      }
      
      return data;
    },
    enabled: !!selectedAccount,
    staleTime: 5 * 60 * 1000,
  });

  // Process data: aggregate resource counts and displayable costs by creator and resource group
  interface CreatorStats {
    creator: string;
    email: string;
    firstName: string;
    lastName: string;
    iamId: string;
    resourceCount: number;
    creatorCost: number;
  }

  interface ResourceGroupStats {
    resourceGroupId: string;
    resourceGroupName: string;
    resourceCount: number;
    resourceNames: string[];
    resourceGroupCost: number;
    primaryCreatorEmail?: string;
  }

  const { creatorStats, resourceGroupStats, totalCost } = useMemo(() => {
    if (!accountSummary?.resourceInstances || !accountSummary?.resources) {
      return { creatorStats: [] as CreatorStats[], resourceGroupStats: [] as ResourceGroupStats[], totalCost: 0 };
    }

    const total = accountSummary.resources.reduce(
      (sum, usageResource) => sum + (usageResource.billable_cost || 0),
      0,
    );

    const creatorCostMap = new Map(
      (accountSummary.costAllocation?.creatorCosts || []).map((entry) => [entry.creatorKey, entry]),
    );

    const resourceGroupCostMap = new Map(
      (accountSummary.costAllocation?.resourceGroupCosts || []).map((entry) => [entry.resourceGroupId, entry]),
    );

    const creatorMap = new Map<string, CreatorStats>();
    const resourceGroupMap = new Map<string, ResourceGroupStats>();
    // Track creator counts per resource group for determining primary creator
    const resourceGroupCreatorCounts = new Map<string, Map<string, number>>();

    accountSummary.resourceInstances.forEach((instance) => {
      const profile = instance.creatorProfile;
      const rawCreator = instance.createdBy || instance.created_by || 'Unknown';
      const creator = String(rawCreator);
      const email = profile?.email || (creator.includes('@') ? creator : '');
      const firstName = profile?.firstName || '';
      const lastName = profile?.lastName || '';
      const iamId = profile?.iamId || (!creator.includes('@') && creator !== 'Unknown' ? creator : '');
      const resourceGroupId = instance.resourceGroupId || instance.resource_group_id || 'Unknown';
      const resourceGroupName = instance.resourceGroupName || resourceGroupId || 'Unknown';

      if (!creatorMap.has(creator)) {
        creatorMap.set(creator, {
          creator,
          email,
          firstName,
          lastName,
          iamId,
          resourceCount: 0,
          creatorCost: creatorCostMap.get(creator)?.cost || 0,
        });
      }

      const creatorData = creatorMap.get(creator)!;
      if (!creatorData.email && email) creatorData.email = email;
      if (!creatorData.firstName && firstName) creatorData.firstName = firstName;
      if (!creatorData.lastName && lastName) creatorData.lastName = lastName;
      if (!creatorData.iamId && iamId) creatorData.iamId = iamId;
      creatorData.resourceCount += 1;
      creatorData.creatorCost = creatorCostMap.get(creator)?.cost || creatorData.creatorCost || 0;

      if (!resourceGroupMap.has(resourceGroupId)) {
        resourceGroupMap.set(resourceGroupId, {
          resourceGroupId,
          resourceGroupName,
          resourceCount: 0,
          resourceNames: [],
          resourceGroupCost: resourceGroupCostMap.get(resourceGroupId)?.cost || 0,
        });
      }

      const rgData = resourceGroupMap.get(resourceGroupId)!;
      rgData.resourceCount += 1;
      if (!rgData.resourceNames.includes(instance.name)) {
        rgData.resourceNames.push(instance.name);
      }
      rgData.resourceGroupCost = resourceGroupCostMap.get(resourceGroupId)?.cost || rgData.resourceGroupCost || 0;
      if (
        (!rgData.resourceGroupName || rgData.resourceGroupName === rgData.resourceGroupId) &&
        resourceGroupName
      ) {
        rgData.resourceGroupName = resourceGroupName;
      }
      
      // Track creator counts for this resource group
      if (profile?.email) {
        if (!resourceGroupCreatorCounts.has(resourceGroupId)) {
          resourceGroupCreatorCounts.set(resourceGroupId, new Map<string, number>());
        }
        const creatorCounts = resourceGroupCreatorCounts.get(resourceGroupId)!;
        const count = creatorCounts.get(profile.email) || 0;
        creatorCounts.set(profile.email, count + 1);
      }
    });

    accountSummary.costAllocation?.resourceGroupCosts?.forEach((entry) => {
      if (!resourceGroupMap.has(entry.resourceGroupId)) {
        resourceGroupMap.set(entry.resourceGroupId, {
          resourceGroupId: entry.resourceGroupId,
          resourceGroupName: entry.resourceGroupName || entry.resourceGroupId,
          resourceCount: entry.resourceCount,
          resourceNames: entry.resourceNames,
          resourceGroupCost: entry.cost,
        });
      }
    });

    // Determine primary creator for each resource group
    resourceGroupMap.forEach((rgData, resourceGroupId) => {
      const creatorCounts = resourceGroupCreatorCounts.get(resourceGroupId);
      
      if (creatorCounts && creatorCounts.size > 0) {
        let primaryCreatorEmail: string | undefined;
        let maxCount = 0;
        
        creatorCounts.forEach((count, email) => {
          if (count > maxCount) {
            maxCount = count;
            primaryCreatorEmail = email;
          }
        });
        
        rgData.primaryCreatorEmail = primaryCreatorEmail;
      }
    });

    const creatorStatsArray = Array.from(creatorMap.values()).sort((a, b) => b.creatorCost - a.creatorCost || b.resourceCount - a.resourceCount);
    
    // DEBUG: Log first creator row derived for dashboard rendering
    if (creatorStatsArray.length > 0) {
      const firstCreator = creatorStatsArray[0]!;
      console.log('[DEBUG] First creator row derived for dashboard:', {
        creator: firstCreator.creator,
        email: firstCreator.email,
        firstName: firstCreator.firstName,
        lastName: firstCreator.lastName,
        iamId: firstCreator.iamId,
        resourceCount: firstCreator.resourceCount,
        creatorCost: firstCreator.creatorCost,
      });
    }
    
    return {
      creatorStats: creatorStatsArray,
      resourceGroupStats: Array.from(resourceGroupMap.values()).sort((a, b) => b.resourceGroupCost - a.resourceGroupCost || b.resourceCount - a.resourceCount),
      totalCost: total,
    };
  }, [accountSummary]);

  // Professional color palette inspired by IBM Carbon Design System
  const COLORS = [
    '#0f62fe', // IBM Blue
    '#24a148', // Green
    '#da1e28', // Red
    '#8a3ffc', // Purple
    '#ff832b', // Orange
    '#0072c3', // Dark Blue
    '#198038', // Dark Green
    '#a56eff', // Light Purple
    '#fa4d56', // Light Red
    '#ff7eb6', // Pink
    '#6e6e6e', // Gray for "Others"
  ];

  // Transform creator stats into pie chart data with Top 10 + "Others" aggregation
  const creatorPieData: PieChartDataPoint[] = useMemo(() => {
    if (!creatorStats.length || totalCost === 0) return [];
    
    // Sort by cost descending (already sorted from useMemo above)
    const sortedCreators = [...creatorStats].sort((a, b) => b.creatorCost - a.creatorCost);
    
    // Take top 10
    const top10 = sortedCreators.slice(0, 10);
    const remaining = sortedCreators.slice(10);
    
    // Create data points for top 10
    const chartData: PieChartDataPoint[] = top10.map((creator, index) => ({
      name: creator.email || creator.iamId || creator.creator,
      value: creator.creatorCost,
      percentage: (creator.creatorCost / totalCost) * 100,
      color: COLORS[index % COLORS.length],
    }));
    
    // Add "Others" category if there are more than 10 creators
    if (remaining.length > 0) {
      const othersTotal = remaining.reduce((sum, creator) => sum + creator.creatorCost, 0);
      chartData.push({
        name: `Others (${remaining.length} creators)`,
        value: othersTotal,
        percentage: (othersTotal / totalCost) * 100,
        color: COLORS[10], // Gray color for "Others"
      });
    }
    
    return chartData;
  }, [creatorStats, totalCost]);

  // Transform resource group stats into pie chart data with Top 10 + "Others" aggregation
  const resourceGroupPieData: PieChartDataPoint[] = useMemo(() => {
    if (!resourceGroupStats.length || totalCost === 0) return [];
    
    // Sort by cost descending (already sorted from useMemo above)
    const sortedGroups = [...resourceGroupStats].sort((a, b) => b.resourceGroupCost - a.resourceGroupCost);
    
    // Take top 10
    const top10 = sortedGroups.slice(0, 10);
    const remaining = sortedGroups.slice(10);
    
    // Create data points for top 10
    const chartData: PieChartDataPoint[] = top10.map((rg, index) => ({
      name: rg.resourceGroupName,
      value: rg.resourceGroupCost,
      percentage: (rg.resourceGroupCost / totalCost) * 100,
      color: COLORS[index % COLORS.length],
    }));
    
    // Add "Others" category if there are more than 10 resource groups
    if (remaining.length > 0) {
      const othersTotal = remaining.reduce((sum, rg) => sum + rg.resourceGroupCost, 0);
      chartData.push({
        name: `Others (${remaining.length} groups)`,
        value: othersTotal,
        percentage: (othersTotal / totalCost) * 100,
        color: COLORS[10], // Gray color for "Others"
      });
    }
    
    return chartData;
  }, [resourceGroupStats, totalCost]);

  // Table columns
  const creatorColumns: ColumnDef<CreatorStats>[] = [
    {
      accessorKey: 'iamId',
      header: 'IAM ID',
      cell: (info) => (
        <span className="font-mono text-xs text-gray-700">
          {(info.getValue() as string) || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'firstName',
      header: 'First name',
      cell: (info) => (info.getValue() as string) || '—',
    },
    {
      accessorKey: 'lastName',
      header: 'Last name',
      cell: (info) => (info.getValue() as string) || '—',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (info) => (
        <span className="font-mono text-xs text-gray-700">
          {(info.getValue() as string) || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'resourceCount',
      header: 'Resource Count',
      cell: (info) => formatNumber(info.getValue() as number, 0),
    },
    {
      accessorKey: 'creatorCost',
      header: 'Creator Cost',
      cell: (info) => formatCurrency(info.getValue() as number),
    },
  ];

  const resourceGroupColumns: ColumnDef<ResourceGroupStats>[] = [
    {
      accessorKey: 'resourceGroupName',
      header: 'Resource Group',
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="min-w-[260px]">
            <div className="font-medium text-gray-900">{row.resourceGroupName || row.resourceGroupId}</div>
            <div className="font-mono text-xs text-gray-500">{row.resourceGroupId}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'primaryCreatorEmail',
      header: 'Primary Creator',
      cell: (info) => (
        <span className="text-sm text-gray-700">
          {(info.getValue() as string | undefined) || 'N/A'}
        </span>
      ),
    },
    {
      accessorKey: 'resourceNames',
      header: 'Resources',
      cell: (info) => {
        const resourceNames = info.getValue() as string[];
        if (!resourceNames?.length) {
          return '—';
        }

        const visibleNames = resourceNames.slice(0, 3);
        const remainingCount = resourceNames.length - visibleNames.length;

        return (
          <div className="min-w-[280px]">
            <div className="text-sm text-gray-900">{visibleNames.join(', ')}</div>
            {remainingCount > 0 && (
              <div className="text-xs text-gray-500">+{remainingCount} more</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'resourceCount',
      header: 'Resource Count',
      cell: (info) => formatNumber(info.getValue() as number, 0),
    },
    {
      accessorKey: 'resourceGroupCost',
      header: 'Resource Group Cost',
      cell: (info) => formatCurrency(info.getValue() as number),
    },
  ];

  if (!selectedAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cost Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">Account → Creator → Resource Group</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="max-w-md mx-auto text-center">
            <Package className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Select an Account</h2>
            <p className="text-sm text-gray-600">
              Please select an IBM Cloud account from the dropdown in the header to view cost data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cost Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Account cost overview with resource distribution by creator and resource group
        </p>
      </div>

      {/* Account Info & Month Selector */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-blue-700 font-medium">Current Account</p>
            <p className="text-sm text-blue-900 font-mono">{selectedAccount.id}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar className="h-5 w-5 text-blue-600" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-4 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="current">Current Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-3">Last 3 Months</option>
              <option value="last-6">Last 6 Months</option>
              <option value="last-12">Last 12 Months</option>
              <option value="custom">Custom Month</option>
            </select>
            
            {dateRange === 'custom' && (
              <input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                max={format(new Date(), 'yyyy-MM')}
                className="px-4 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" message="Loading cost data..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Failed to load cost data</p>
            <p className="text-red-700 text-sm mt-1">
              {(error as any)?.message || 'An error occurred'}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <>
          {/* 1. ACCOUNT COST */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-blue-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600 mr-3" />
              Total Account Cost
            </h2>
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {formatCurrency(totalCost)}
            </div>
            <p className="text-sm text-gray-600">
              Billable cost for {selectedMonth}
            </p>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Total cost comes from the IBM Cloud Usage Reports summary. Creator and resource-group
                costs are derived by allocating that summary cost across the current resource instances from the same
                4-API dashboard path.
              </p>
            </div>
          </div>

          {/* PIE CHARTS - Cost Distribution */}
          <div className="space-y-6">
            {/* Creator Costs Pie Chart */}
            <div className="bg-white rounded-lg shadow-lg border-l-4 border-blue-500 p-6">
              {creatorPieData.length > 0 ? (
                <CostDistributionChart
                  data={creatorPieData}
                  config={{
                    title: 'Creator Cost Distribution',
                    showLabels: true,
                    showLegend: true,
                    height: 400,
                  }}
                  showExport={true}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No creator cost data available</p>
                </div>
              )}
            </div>

            {/* Resource Group Costs Pie Chart */}
            <div className="bg-white rounded-lg shadow-lg border-l-4 border-green-500 p-6">
              {resourceGroupPieData.length > 0 ? (
                <CostDistributionChart
                  data={resourceGroupPieData}
                  config={{
                    title: 'Resource Group Cost Distribution',
                    showLabels: true,
                    showLegend: true,
                    height: 400,
                  }}
                  showExport={true}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No resource group cost data available</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. RESOURCES BY CREATOR */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-green-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Users className="h-8 w-8 text-green-600 mr-3" />
              Resources by Creator
            </h2>
            {creatorStats.length > 0 ? (
              <DataTable
                data={creatorStats}
                columns={creatorColumns}
                searchPlaceholder="Search creators..."
                pageSize={10}
              />
            ) : (
              <p className="text-gray-600 text-center py-8">No creator data available</p>
            )}
          </div>

          {/* 3. RESOURCES BY RESOURCE GROUP */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-purple-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Layers className="h-8 w-8 text-purple-600 mr-3" />
              Resources by Resource Group
            </h2>
            {resourceGroupStats.length > 0 ? (
              <DataTable
                data={resourceGroupStats}
                columns={resourceGroupColumns}
                searchPlaceholder="Search resource groups..."
                pageSize={10}
              />
            ) : (
              <p className="text-gray-600 text-center py-8">No resource group data available</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

