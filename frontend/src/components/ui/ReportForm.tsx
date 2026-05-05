/**
 * ReportForm Component
 * Reusable form for generating reports with validation
 */

import React, { useState } from 'react';
import { Calendar, Filter, AlertCircle } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { useAccount } from '../../contexts/AccountContext';
import type { GenerateUserSpendingRequest, GenerateTeamSpendingRequest, TimePeriod } from '../../types/api.types';
import { format, subMonths, subQuarters, subYears } from 'date-fns';

export interface ReportFormData {
  reportType: 'user-spending' | 'team-spending';
  period: TimePeriod;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  filters: {
    userEmails?: string[];
    serviceNames?: string[];
    resourceGroups?: string[];
    minCost?: number;
    maxCost?: number;
  };
  includeForecasts: boolean;
  forecastMonths?: number;
  teamName?: string;
}

interface ReportFormProps {
  onSubmit: (data: GenerateUserSpendingRequest | GenerateTeamSpendingRequest) => void;
  isLoading?: boolean;
  error?: string | null;
}

const PERIOD_PRESETS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'month', label: 'Last Month' },
  { value: 'quarter', label: 'Last Quarter' },
  { value: 'year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

export function ReportForm({ onSubmit, isLoading = false, error }: ReportFormProps) {
  const { selectedAccount } = useAccount();
  
  const [formData, setFormData] = useState<ReportFormData>({
    reportType: 'user-spending',
    period: 'month',
    dateRange: {
      startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    },
    filters: {},
    includeForecasts: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Update date range based on period preset
  const handlePeriodChange = (period: TimePeriod) => {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (period) {
      case 'month':
        startDate = subMonths(now, 1);
        break;
      case 'quarter':
        startDate = subQuarters(now, 1);
        break;
      case 'year':
        startDate = subYears(now, 1);
        break;
      case 'custom':
        // Keep current dates for custom
        return setFormData({ ...formData, period });
    }

    setFormData({
      ...formData,
      period,
      dateRange: {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      },
    });
  };

  // Validate form
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedAccount) {
      errors.account = 'Please select an account from the header';
    }

    if (formData.period === 'custom') {
      if (!formData.dateRange.startDate) {
        errors.startDate = 'Start date is required';
      }
      if (!formData.dateRange.endDate) {
        errors.endDate = 'End date is required';
      }
      if (formData.dateRange.startDate && formData.dateRange.endDate) {
        if (new Date(formData.dateRange.startDate) > new Date(formData.dateRange.endDate)) {
          errors.dateRange = 'Start date must be before end date';
        }
      }
    }

    if (formData.reportType === 'team-spending' && !formData.teamName?.trim()) {
      errors.teamName = 'Team name is required for team spending reports';
    }

    if (formData.includeForecasts && formData.forecastMonths) {
      if (formData.forecastMonths < 1 || formData.forecastMonths > 12) {
        errors.forecastMonths = 'Forecast months must be between 1 and 12';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !selectedAccount) {
      return;
    }

    const baseRequest = {
      accountId: selectedAccount.id,
      period: formData.period,
      dateRange: formData.period === 'custom' ? formData.dateRange : undefined,
      filters: Object.keys(formData.filters).length > 0 ? formData.filters : undefined,
      includeForecasts: formData.includeForecasts || undefined,
    };

    if (formData.reportType === 'user-spending') {
      onSubmit({
        ...baseRequest,
        forecastMonths: formData.includeForecasts ? formData.forecastMonths : undefined,
      } as GenerateUserSpendingRequest);
    } else {
      onSubmit({
        ...baseRequest,
        teamName: formData.teamName,
      } as GenerateTeamSpendingRequest);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Account Selection Notice */}
      {!selectedAccount && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Account Required</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Please select an account from the dropdown in the header before generating a report.
            </p>
          </div>
        </div>
      )}

      {selectedAccount && selectedAccount.resourceGroupCount === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            ℹ️ Using manually entered account ID. Ensure you have access to this account.
          </p>
        </div>
      )}

      {validationErrors.account && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{validationErrors.account}</p>
        </div>
      )}

      {/* Report Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Report Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, reportType: 'user-spending' })}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              formData.reportType === 'user-spending'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            disabled={isLoading}
          >
            <div className="font-medium text-gray-900">User Spending</div>
            <div className="text-sm text-gray-500 mt-1">Analyze spending by individual users</div>
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, reportType: 'team-spending' })}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              formData.reportType === 'team-spending'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            disabled={isLoading}
          >
            <div className="font-medium text-gray-900">Team Spending</div>
            <div className="text-sm text-gray-500 mt-1">Analyze team-wide spending patterns</div>
          </button>
        </div>
      </div>

      {/* Team Name (for team spending) */}
      {formData.reportType === 'team-spending' && (
        <div>
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-2">
            Team Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="teamName"
            value={formData.teamName || ''}
            onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              validationErrors.teamName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter team name"
            disabled={isLoading}
          />
          {validationErrors.teamName && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.teamName}</p>
          )}
        </div>
      )}

      {/* Time Period */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Period <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePeriodChange(preset.value)}
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                formData.period === preset.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
              disabled={isLoading}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range */}
      {formData.period === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline h-4 w-4 mr-1" />
            Custom Date Range
          </label>
          <DateRangePicker
            value={formData.dateRange}
            onChange={(range) => setFormData({ ...formData, dateRange: range })}
            maxMonths={24}
          />
          {validationErrors.dateRange && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.dateRange}</p>
          )}
        </div>
      )}

      {/* Forecasting Options */}
      <div className="border-t pt-6">
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="includeForecasts"
            checked={formData.includeForecasts}
            onChange={(e) => setFormData({ ...formData, includeForecasts: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={isLoading}
          />
          <label htmlFor="includeForecasts" className="ml-2 text-sm font-medium text-gray-700">
            Include cost forecasts
          </label>
        </div>

        {formData.includeForecasts && formData.reportType === 'user-spending' && (
          <div className="ml-6">
            <label htmlFor="forecastMonths" className="block text-sm text-gray-600 mb-2">
              Forecast months ahead
            </label>
            <input
              type="number"
              id="forecastMonths"
              min="1"
              max="12"
              value={formData.forecastMonths || 3}
              onChange={(e) => setFormData({ ...formData, forecastMonths: parseInt(e.target.value) })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {validationErrors.forecastMonths && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.forecastMonths}</p>
            )}
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          disabled={isLoading}
        >
          <Filter className="h-4 w-4 mr-2" />
          {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
        </button>

        {showAdvancedFilters && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
            {/* User Email Filter */}
            {formData.reportType === 'user-spending' && (
              <div>
                <label htmlFor="userEmails" className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by User Emails (comma-separated)
                </label>
                <input
                  type="text"
                  id="userEmails"
                  placeholder="user1@example.com, user2@example.com"
                  onChange={(e) => {
                    const emails = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setFormData({
                      ...formData,
                      filters: { ...formData.filters, userEmails: emails.length > 0 ? emails : undefined },
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Service Filter */}
            <div>
              <label htmlFor="serviceNames" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Services (comma-separated)
              </label>
              <input
                type="text"
                id="serviceNames"
                placeholder="compute, storage, database"
                onChange={(e) => {
                  const services = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  setFormData({
                    ...formData,
                    filters: { ...formData.filters, serviceNames: services.length > 0 ? services : undefined },
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>

            {/* Cost Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minCost" className="block text-sm font-medium text-gray-700 mb-2">
                  Min Cost ($)
                </label>
                <input
                  type="number"
                  id="minCost"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    setFormData({
                      ...formData,
                      filters: { ...formData.filters, minCost: value },
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="maxCost" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Cost ($)
                </label>
                <input
                  type="number"
                  id="maxCost"
                  min="0"
                  step="0.01"
                  placeholder="No limit"
                  onChange={(e) => {
                    const value = e.target.value ? parseFloat(e.target.value) : undefined;
                    setFormData({
                      ...formData,
                      filters: { ...formData.filters, maxCost: value },
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-4 pt-6 border-t">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            'Generate Report'
          )}
        </button>
      </div>
    </form>
  );
}

// Made with Bob