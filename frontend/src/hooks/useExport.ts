/**
 * useExport Hook
 * React hook for export functionality
 */

import { useState, useCallback } from 'react';
import { exportService } from '../services/export.service';
import type { ChartExportOptions } from '../types/chart.types';
import type { Report } from '../types/report.types';
import type { ReportExportFormat } from '../types/api.types';

/**
 * Export state
 */
interface ExportState {
  isExporting: boolean;
  error: string | null;
  progress: number;
}

/**
 * Hook for exporting charts
 */
export function useChartExport() {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
    progress: 0,
  });

  const exportAsPNG = useCallback(
    async (chartElement: HTMLElement, options?: Partial<ChartExportOptions>) => {
      setState({ isExporting: true, error: null, progress: 0 });
      try {
        await exportService.exportChartAsPNG(chartElement, options);
        setState({ isExporting: false, error: null, progress: 100 });
      } catch (error) {
        setState({
          isExporting: false,
          error: error instanceof Error ? error.message : 'Export failed',
          progress: 0,
        });
        throw error;
      }
    },
    []
  );

  const exportAsJPEG = useCallback(
    async (chartElement: HTMLElement, options?: Partial<ChartExportOptions>) => {
      setState({ isExporting: true, error: null, progress: 0 });
      try {
        await exportService.exportChartAsJPEG(chartElement, options);
        setState({ isExporting: false, error: null, progress: 100 });
      } catch (error) {
        setState({
          isExporting: false,
          error: error instanceof Error ? error.message : 'Export failed',
          progress: 0,
        });
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isExporting: false, error: null, progress: 0 });
  }, []);

  return {
    ...state,
    exportAsPNG,
    exportAsJPEG,
    reset,
  };
}

/**
 * Hook for exporting data
 */
export function useDataExport() {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
    progress: 0,
  });

  const exportAsCSV = useCallback(
    (data: Record<string, unknown>[], filename?: string) => {
      setState({ isExporting: true, error: null, progress: 0 });
      try {
        exportService.exportAsCSV(data, filename);
        setState({ isExporting: false, error: null, progress: 100 });
      } catch (error) {
        setState({
          isExporting: false,
          error: error instanceof Error ? error.message : 'Export failed',
          progress: 0,
        });
        throw error;
      }
    },
    []
  );

  const exportAsJSON = useCallback((data: unknown, filename?: string) => {
    setState({ isExporting: true, error: null, progress: 0 });
    try {
      exportService.exportAsJSON(data, filename);
      setState({ isExporting: false, error: null, progress: 100 });
    } catch (error) {
      setState({
        isExporting: false,
        error: error instanceof Error ? error.message : 'Export failed',
        progress: 0,
      });
      throw error;
    }
  }, []);

  const exportAsExcel = useCallback(
    (
      data: Record<string, unknown>[] | Record<string, Record<string, unknown>[]>,
      filename?: string
    ) => {
      setState({ isExporting: true, error: null, progress: 0 });
      try {
        exportService.exportAsExcel(data, filename);
        setState({ isExporting: false, error: null, progress: 100 });
      } catch (error) {
        setState({
          isExporting: false,
          error: error instanceof Error ? error.message : 'Export failed',
          progress: 0,
        });
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isExporting: false, error: null, progress: 0 });
  }, []);

  return {
    ...state,
    exportAsCSV,
    exportAsJSON,
    exportAsExcel,
    reset,
  };
}

/**
 * Hook for exporting reports
 */
export function useReportExport() {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
    progress: 0,
  });

  const exportReportAsPDF = useCallback(
    async (report: Report, chartElements: HTMLElement[], filename?: string) => {
      setState({ isExporting: true, error: null, progress: 0 });
      try {
        await exportService.exportReportAsPDF(report, chartElements, filename);
        setState({ isExporting: false, error: null, progress: 100 });
      } catch (error) {
        setState({
          isExporting: false,
          error: error instanceof Error ? error.message : 'Export failed',
          progress: 0,
        });
        throw error;
      }
    },
    []
  );

  const exportReportAsExcel = useCallback((report: Report, filename?: string) => {
    setState({ isExporting: true, error: null, progress: 0 });
    try {
      exportService.exportReportAsExcel(report, filename);
      setState({ isExporting: false, error: null, progress: 100 });
    } catch (error) {
      setState({
        isExporting: false,
        error: error instanceof Error ? error.message : 'Export failed',
        progress: 0,
      });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isExporting: false, error: null, progress: 0 });
  }, []);

  return {
    ...state,
    exportReportAsPDF,
    exportReportAsExcel,
    reset,
  };
}

/**
 * Hook for batch exporting multiple charts
 */
export function useBatchChartExport() {
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    error: null,
    progress: 0,
  });

  const exportMultipleCharts = useCallback(
    async (
      chartElements: HTMLElement[],
      format: 'png' | 'jpeg' = 'png',
      options?: Partial<ChartExportOptions>
    ) => {
      setState({ isExporting: true, error: null, progress: 0 });
      
      try {
        const total = chartElements.length;
        
        for (let i = 0; i < total; i++) {
          const element = chartElements[i];
          if (!element) continue;

          const filename = exportService.generateFilename(
            `chart-${i + 1}`,
            format
          );

          if (format === 'png') {
            await exportService.exportChartAsPNG(element, {
              ...options,
              filename,
            });
          } else {
            await exportService.exportChartAsJPEG(element, {
              ...options,
              filename,
            });
          }

          setState({
            isExporting: true,
            error: null,
            progress: Math.round(((i + 1) / total) * 100),
          });
        }

        setState({ isExporting: false, error: null, progress: 100 });
      } catch (error) {
        setState({
          isExporting: false,
          error: error instanceof Error ? error.message : 'Batch export failed',
          progress: 0,
        });
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isExporting: false, error: null, progress: 0 });
  }, []);

  return {
    ...state,
    exportMultipleCharts,
    reset,
  };
}

/**
 * Hook to generate export filename
 */
export function useExportFilename() {
  const generateFilename = useCallback(
    (prefix: string, format: ReportExportFormat) => {
      return exportService.generateFilename(prefix, format);
    },
    []
  );

  return { generateFilename };
}

// Made with Bob
