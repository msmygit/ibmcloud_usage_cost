/**
 * ReportGenerator Page
 * Form for generating cost analysis reports with real-time progress tracking
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { ReportForm } from '../components/ui/ReportForm';
import { ProgressIndicator } from '../components/ui/ProgressIndicator';
import { useGenerateUserSpendingReport, useGenerateTeamSpendingReport } from '../hooks/useReports';
import { useReportProgress, useWebSocketConnection } from '../hooks/useWebSocket';
import type { GenerateUserSpendingRequest, GenerateTeamSpendingRequest } from '../types/api.types';

export function ReportGenerator() {
  const navigate = useNavigate();
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'user-spending' | 'team-spending'>('user-spending');
  const [showSuccess, setShowSuccess] = useState(false);

  // WebSocket connection
  const { isConnected, connectionState } = useWebSocketConnection();

  // Report generation mutations
  const {
    mutate: generateUserReport,
    isPending: isGeneratingUser,
    error: userError,
  } = useGenerateUserSpendingReport();

  const {
    mutate: generateTeamReport,
    isPending: isGeneratingTeam,
    error: teamError,
  } = useGenerateTeamSpendingReport();

  // Progress tracking
  const {
    progress,
    isComplete,
    error: progressError,
    cancelReport,
  } = useReportProgress(reportId || '');

  const isGenerating = isGeneratingUser || isGeneratingTeam;
  const error = userError || teamError || progressError;

  // Handle form submission
  const handleSubmit = (data: GenerateUserSpendingRequest | GenerateTeamSpendingRequest) => {
    if ('forecastMonths' in data) {
      // User spending report
      setReportType('user-spending');
      generateUserReport(data, {
        onSuccess: (response) => {
          setReportId(response.reportId);
        },
        onError: (err) => {
          console.error('Failed to generate user spending report:', err);
        },
      });
    } else {
      // Team spending report
      setReportType('team-spending');
      generateTeamReport(data, {
        onSuccess: (response) => {
          setReportId(response.reportId);
        },
        onError: (err) => {
          console.error('Failed to generate team spending report:', err);
        },
      });
    }
  };

  // Handle report completion
  useEffect(() => {
    if (isComplete && reportId) {
      setShowSuccess(true);
      // Redirect to report viewer after 2 seconds
      const timer = setTimeout(() => {
        navigate(`/reports/${reportId}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, reportId, navigate]);

  // Handle cancel
  const handleCancel = () => {
    if (reportId) {
      cancelReport();
      setReportId(null);
      setShowSuccess(false);
    }
    return Promise.resolve();
  };

  // Reset state when starting new report
  const handleReset = () => {
    setReportId(null);
    setShowSuccess(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Generate Report</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create a custom cost analysis report with real-time progress tracking
        </p>
      </div>

      {/* WebSocket Connection Status */}
      {!isConnected && connectionState !== 'connected' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Real-time progress updates unavailable. Connection status: {connectionState}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {!reportId ? (
          // Report Generation Form
          <>
            <div className="flex items-center mb-6">
              <FileText className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Report Configuration</h2>
            </div>
            <ReportForm
              onSubmit={handleSubmit}
              isLoading={isGenerating}
              error={error ? (error as any).message || 'An error occurred' : null}
            />
          </>
        ) : showSuccess ? (
          // Success State
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Report Generated Successfully!
            </h3>
            <p className="text-gray-600 mb-6">
              Redirecting to report viewer...
            </p>
            <button
              onClick={() => navigate(`/reports/${reportId}`)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Report Now
            </button>
          </div>
        ) : progressError ? (
          // Error State
          <div className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Report Generation Failed
            </h3>
            <p className="text-gray-600 mb-6">
              {progressError}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View Reports
              </button>
            </div>
          </div>
        ) : (
          // Progress Tracking
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <FileText className="h-6 w-6 text-blue-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Generating Report</h2>
              </div>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Cancel
              </button>
            </div>

            {progress && (
              <ProgressIndicator
                progress={progress}
                onCancel={handleCancel}
              />
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Report Details</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-blue-700 font-medium">Report ID</dt>
                  <dd className="text-blue-900 font-mono">{reportId}</dd>
                </div>
                <div>
                  <dt className="text-blue-700 font-medium">Type</dt>
                  <dd className="text-blue-900 capitalize">{reportType.replace('-', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-blue-700 font-medium">Status</dt>
                  <dd className="text-blue-900 capitalize">{progress?.status || 'pending'}</dd>
                </div>
                <div>
                  <dt className="text-blue-700 font-medium">Progress</dt>
                  <dd className="text-blue-900">{progress?.progress || 0}%</dd>
                </div>
              </dl>
            </div>

            <div className="text-sm text-gray-600 text-center">
              <p>This may take a few minutes depending on the data volume.</p>
              <p className="mt-1">You can safely leave this page - we'll save your report.</p>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      {!reportId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Tips for Better Reports</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Use shorter time periods for faster report generation</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Apply filters to focus on specific users, services, or cost ranges</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Enable forecasts to predict future spending trends</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Team spending reports provide aggregated insights across all users</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Made with Bob
