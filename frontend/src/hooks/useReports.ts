/**
 * useReports Hook
 * React Query hook for report operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api.service';
import type {
  GenerateUserSpendingRequest,
  GenerateTeamSpendingRequest,
  GenerateReportResponse,
  ExportReportRequest,
} from '../types/api.types';
import type { Report } from '../types/report.types';

/**
 * Query keys for reports
 */
export const reportKeys = {
  all: ['reports'] as const,
  detail: (id: string) => ['reports', id] as const,
  list: (filters?: Record<string, unknown>) => ['reports', 'list', filters] as const,
};

/**
 * Hook to generate user spending report
 */
export function useGenerateUserSpendingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateUserSpendingRequest) =>
      apiService.generateUserSpendingReport(request),
    onSuccess: (data: GenerateReportResponse) => {
      // Invalidate reports list
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

/**
 * Hook to generate team spending report
 */
export function useGenerateTeamSpendingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateTeamSpendingRequest) =>
      apiService.generateTeamSpendingReport(request),
    onSuccess: (data: GenerateReportResponse) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

/**
 * Hook to fetch a report by ID
 */
export function useReport(reportId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: reportKeys.detail(reportId),
    queryFn: () => apiService.getReport(reportId),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });
}

/**
 * Hook to cancel report generation
 */
export function useCancelReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId: string) => apiService.cancelReport(reportId),
    onSuccess: (_, reportId) => {
      // Invalidate the specific report query
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(reportId) });
    },
  });
}

/**
 * Hook to export report
 */
export function useExportReport() {
  return useMutation({
    mutationFn: ({
      reportId,
      options,
    }: {
      reportId: string;
      options: ExportReportRequest;
    }) => apiService.exportReport(reportId, options),
  });
}

/**
 * Hook to download report
 */
export function useDownloadReport() {
  return useMutation({
    mutationFn: ({ reportId, format }: { reportId: string; format: string }) =>
      apiService.downloadReport(reportId, format),
  });
}

/**
 * Hook to prefetch a report
 */
export function usePrefetchReport() {
  const queryClient = useQueryClient();

  return (reportId: string) => {
    queryClient.prefetchQuery({
      queryKey: reportKeys.detail(reportId),
      queryFn: () => apiService.getReport(reportId),
      staleTime: 5 * 60 * 1000,
    });
  };
}

/**
 * Hook to get cached report data
 */
export function useCachedReport(reportId: string): Report | undefined {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Report>(reportKeys.detail(reportId));
}

/**
 * Hook to invalidate report queries
 */
export function useInvalidateReports() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: reportKeys.all }),
    invalidateReport: (reportId: string) =>
      queryClient.invalidateQueries({ queryKey: reportKeys.detail(reportId) }),
  };
}

// Made with Bob
