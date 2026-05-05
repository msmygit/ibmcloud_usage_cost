/**
 * Reports Page
 * Displays a list of all generated reports
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Clock, TrendingUp, Calendar, DollarSign, Users, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { apiService } from '../services/api.service';
import { formatCurrency, formatDate } from '../utils/formatters';

interface ReportSummary {
  reportId: string;
  accountId: string;
  type: 'user-spending' | 'team-spending';
  generatedAt: string;
  storedAt: string;
  totalCost: number;
  currency: string;
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.listReports();
      setReports(response.data?.reports || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError('Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (reportId: string) => {
    navigate(`/reports/${reportId}`);
  };

  const handleGenerateNew = () => {
    navigate('/reports/generate');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Error Loading Reports</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={loadReports}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-2">
            View and manage your generated spending reports
          </p>
        </div>
        <button
          onClick={handleGenerateNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Generate New Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 space-y-6">
          <div className="flex justify-center">
            <FileText className="h-24 w-24 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">No Reports Yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Get started by generating your first spending report to analyze costs and track usage.
            </p>
          </div>
          <button
            onClick={handleGenerateNew}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Generate Your First Report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <div
              key={report.reportId}
              onClick={() => handleViewReport(report.reportId)}
              className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {report.type === 'user-spending' ? (
                    <Users className="h-8 w-8 text-blue-600" />
                  ) : (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {report.type === 'user-spending' ? 'User Spending' : 'Team Spending'}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize">{report.period}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">
                    {formatCurrency(report.totalCost, report.currency)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(report.dateRange.startDate)} - {formatDate(report.dateRange.endDate)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Generated {formatDate(report.generatedAt)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewReport(report.reportId);
                  }}
                  className="w-full text-center text-sm text-primary hover:text-primary/80 font-medium"
                >
                  View Report →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Made with Bob
