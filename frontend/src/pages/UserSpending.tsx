/**
 * UserSpending Page
 * Analyze spending by user with filtering and comparison
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, TrendingUp, DollarSign, Package } from 'lucide-react';
import { CostCard } from '../components/ui/CostCard';
import { CostTrendChart } from '../components/charts/CostTrendChart';
import { CostDistributionChart } from '../components/charts/CostDistributionChart';
import { UserComparisonChart } from '../components/charts/UserComparisonChart';
import { DataTable } from '../components/ui/DataTable';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { useAccount } from '../contexts/AccountContext';
import { apiService } from '../services/api.service';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { format, subMonths, parseISO } from 'date-fns';
import type { UsageQueryParams } from '../types/api.types';
import type { ColumnDef } from '@tanstack/react-table';

export function UserSpending() {
  const { selectedAccount } = useAccount();
  const [userFilter, setUserFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

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
    queryKey: ['user-spending', selectedAccount?.id, monthRange.startMonth, monthRange.endMonth],
    queryFn: () =>
      apiService.getUsage({
        accountId: selectedAccount!.id,
        startMonth: monthRange.startMonth,
        endMonth: monthRange.endMonth,
      } as UsageQueryParams),
    enabled: !!selectedAccount,
    staleTime: 5 * 60 * 1000,
  });

  // Process user spending data
  const userSpendingData = useMemo(() => {
    if (!usageData?.resources) return [];

    // Group by user
    const userMap = new Map<string, {
      userEmail: string;
      totalCost: number;
      resourceCount: number;
      services: Set<string>;
      monthlyData: Map<string, number>;
    }>();

    usageData.resources.forEach((resource: any) => {
      const userEmail = resource.created_by || 'Unknown';
      
      if (!userMap.has(userEmail)) {
        userMap.set(userEmail, {
          userEmail,
          totalCost: 0,
          resourceCount: 0,
          services: new Set(),
          monthlyData: new Map(),
        });
      }

      const userData = userMap.get(userEmail)!;
      userData.resourceCount++;
      userData.services.add(resource.resource_name || 'Unknown');

      resource.usage?.forEach((u: any) => {
        const cost = u.cost || 0;
        userData.totalCost += cost;
        const month = u.month || 'Unknown';
        userData.monthlyData.set(month, (userData.monthlyData.get(month) || 0) + cost);
      });
    });

    return Array.from(userMap.values())
      .map(user => ({
        userEmail: user.userEmail,
        totalCost: user.totalCost,
        resourceCount: user.resourceCount,
        serviceCount: user.services.size,
        monthlyData: Array.from(user.monthlyData.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, value]) => ({ name, value })),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [usageData]);

  // Filter users
  const filteredUsers = useMemo(() => {
    if (!userFilter) return userSpendingData;
    const filter = userFilter.toLowerCase();
    return userSpendingData.filter(user =>
      user.userEmail.toLowerCase().includes(filter)
    );
  }, [userSpendingData, userFilter]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalCost = filteredUsers.reduce((sum, user) => sum + user.totalCost, 0);
    const totalUsers = filteredUsers.length;
    const totalResources = filteredUsers.reduce((sum, user) => sum + user.resourceCount, 0);
    const avgCostPerUser = totalUsers > 0 ? totalCost / totalUsers : 0;

    return {
      totalCost,
      totalUsers,
      totalResources,
      avgCostPerUser,
    };
  }, [filteredUsers]);

  // Prepare chart data
  const topUsersData = useMemo(() => {
    return filteredUsers.slice(0, 10).map(user => ({
      name: user.userEmail.split('@')[0] || user.userEmail,
      cost: user.totalCost,
      resources: user.resourceCount,
    }));
  }, [filteredUsers]);

  const distributionData = useMemo(() => {
    const total = summaryMetrics.totalCost;
    return filteredUsers.slice(0, 5).map(user => ({
      name: user.userEmail.split('@')[0] || user.userEmail,
      value: user.totalCost,
      percentage: total > 0 ? (user.totalCost / total) * 100 : 0,
    }));
  }, [filteredUsers, summaryMetrics.totalCost]);

  // Aggregate monthly trend across all users
  const trendData = useMemo(() => {
    const monthlyTotals = new Map<string, number>();
    
    filteredUsers.forEach(user => {
      user.monthlyData.forEach(({ name, value }) => {
        monthlyTotals.set(name, (monthlyTotals.get(name) || 0) + value);
      });
    });

    return Array.from(monthlyTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));
  }, [filteredUsers]);

  // Table columns
  const tableColumns: ColumnDef<typeof filteredUsers[0]>[] = [
    {
      accessorKey: 'userEmail',
      header: 'User Email',
      cell: (info) => info.getValue(),
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

  // Show message if no account is selected
  if (!selectedAccount) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Spending</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Analyze spending by user and team
          </p>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-8">
          <div className="max-w-md mx-auto text-center">
            <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Select an Account
            </h2>
            <p className="text-sm text-muted-foreground">
              Please select an IBM Cloud account from the dropdown in the header to analyze user spending.
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
        <h1 className="text-3xl font-bold text-foreground">User Spending</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Analyze spending by user and team
        </p>
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

      {/* Filters */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* User Search */}
          <div>
            <label htmlFor="userFilter" className="block text-sm font-medium text-foreground mb-2">
              <Search className="inline h-4 w-4 mr-1" />
              Search Users
            </label>
            <input
              type="text"
              id="userFilter"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Filter by email..."
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Date Range
            </label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              maxMonths={12}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" message="Loading user spending data..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            {(error as any)?.message || 'Failed to load user spending data.'}
          </p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
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
              title="Total Users"
              value={summaryMetrics.totalUsers}
              currency=""
              icon={<Users className="h-6 w-6 text-green-600" />}
            />
            <CostCard
              title="Total Resources"
              value={summaryMetrics.totalResources}
              currency=""
              icon={<Package className="h-6 w-6 text-purple-600" />}
            />
            <CostCard
              title="Avg Cost/User"
              value={summaryMetrics.avgCostPerUser}
              currency="USD"
              icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
            />
          </div>

          {/* Charts */}
          {filteredUsers.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {trendData.length > 0 && (
                  <CostTrendChart
                    data={trendData}
                    config={{
                      title: 'User Spending Trend',
                      height: 350,
                    }}
                  />
                )}
                {distributionData.length > 0 && (
                  <CostDistributionChart
                    data={distributionData}
                    config={{
                      title: 'Top 5 Users by Cost',
                      height: 350,
                    }}
                  />
                )}
              </div>

              {topUsersData.length > 0 && (
                <UserComparisonChart
                  data={topUsersData}
                  config={{
                    title: 'Top 10 Users Comparison',
                    height: 400,
                  }}
                />
              )}

              {/* User Table */}
              <div className="bg-card rounded-lg shadow-sm border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  User Spending Details
                </h2>
                <DataTable
                  data={filteredUsers}
                  columns={tableColumns}
                  searchPlaceholder="Search users..."
                  pageSize={20}
                />
              </div>
            </>
          ) : (
            <div className="bg-muted border border-border rounded-lg p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {userFilter
                  ? 'No users found matching your filter.'
                  : 'No user spending data available for the selected period.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Made with Bob
