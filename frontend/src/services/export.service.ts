/**
 * Export Service
 * Handles exporting charts and data in various formats
 */

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { ChartExportOptions } from '../types/chart.types';
import type { Report } from '../types/report.types';

/**
 * Export Service class
 */
class ExportService {
  /**
   * Export chart as PNG
   */
  async exportChartAsPNG(
    chartElement: HTMLElement,
    options: Partial<ChartExportOptions> = {}
  ): Promise<void> {
    const {
      width = 1920,
      height = 1080,
      quality = 1.0,
      backgroundColor = '#ffffff',
      filename = 'chart.png',
    } = options;

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartElement, {
        width,
        height,
        backgroundColor,
        scale: 2, // Higher resolution
        logging: false,
      });

      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            this.downloadBlob(blob, filename);
          }
        },
        'image/png',
        quality
      );
    } catch (error) {
      console.error('Failed to export chart as PNG:', error);
      throw new Error('Failed to export chart as PNG');
    }
  }

  /**
   * Export chart as JPEG
   */
  async exportChartAsJPEG(
    chartElement: HTMLElement,
    options: Partial<ChartExportOptions> = {}
  ): Promise<void> {
    const {
      width = 1920,
      height = 1080,
      quality = 0.95,
      backgroundColor = '#ffffff',
      filename = 'chart.jpg',
    } = options;

    try {
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartElement, {
        width,
        height,
        backgroundColor,
        scale: 2,
        logging: false,
      });

      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            this.downloadBlob(blob, filename);
          }
        },
        'image/jpeg',
        quality
      );
    } catch (error) {
      console.error('Failed to export chart as JPEG:', error);
      throw new Error('Failed to export chart as JPEG');
    }
  }

  /**
   * Export data as CSV
   */
  exportAsCSV(data: Record<string, unknown>[], filename = 'data.csv'): void {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]!);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => this.escapeCsvValue(row[header])).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Export data as JSON
   */
  exportAsJSON(data: unknown, filename = 'data.json'): void {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Export report as PDF
   */
  async exportReportAsPDF(
    report: Report,
    chartElements: HTMLElement[],
    filename = 'report.pdf'
  ): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Add title
      pdf.setFontSize(20);
      pdf.text('IBM Cloud Cost Report', margin, margin + 10);

      // Add metadata
      pdf.setFontSize(10);
      let yPos = margin + 20;
      pdf.text(`Report ID: ${report.reportId}`, margin, yPos);
      yPos += 6;
      pdf.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, margin, yPos);
      yPos += 6;
      pdf.text(`Period: ${report.period}`, margin, yPos);
      yPos += 10;

      // Add summary if available
      if ('summary' in report) {
        pdf.setFontSize(14);
        pdf.text('Summary', margin, yPos);
        yPos += 8;
        pdf.setFontSize(10);
        pdf.text(`Total Cost: ${report.summary.currency} ${report.summary.totalCost.toFixed(2)}`, margin, yPos);
        yPos += 6;
        pdf.text(`Total Users: ${report.summary.totalUsers}`, margin, yPos);
        yPos += 6;
        pdf.text(`Total Resources: ${report.summary.totalResources}`, margin, yPos);
        yPos += 10;
      }

      // Add charts
      const html2canvas = (await import('html2canvas')).default;
      
      for (let i = 0; i < chartElements.length; i++) {
        if (yPos > pageHeight - 80) {
          pdf.addPage();
          yPos = margin;
        }

        const chartElement = chartElements[i];
        if (!chartElement) continue;

        const canvas = await html2canvas(chartElement, {
          scale: 2,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
      }

      pdf.save(filename);
    } catch (error) {
      console.error('Failed to export report as PDF:', error);
      throw new Error('Failed to export report as PDF');
    }
  }

  /**
   * Export data as Excel
   */
  exportAsExcel(
    data: Record<string, unknown>[] | Record<string, Record<string, unknown>[]>,
    filename = 'data.xlsx'
  ): void {
    try {
      const workbook = XLSX.utils.book_new();

      if (Array.isArray(data)) {
        // Single sheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      } else {
        // Multiple sheets
        Object.entries(data).forEach(([sheetName, sheetData]) => {
          const worksheet = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });
      }

      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Failed to export as Excel:', error);
      throw new Error('Failed to export as Excel');
    }
  }

  /**
   * Export report data as Excel with multiple sheets
   */
  exportReportAsExcel(report: Report, filename = 'report.xlsx'): void {
    const sheets: Record<string, Record<string, unknown>[]> = {};

    // Summary sheet
    if ('summary' in report) {
      sheets['Summary'] = [
        {
          'Report ID': report.reportId,
          'Generated At': new Date(report.generatedAt).toLocaleString(),
          'Period': report.period,
          'Total Cost': report.summary.totalCost,
          'Currency': report.summary.currency,
          'Total Users': report.summary.totalUsers,
          'Total Resources': report.summary.totalResources,
        },
      ];
    }

    // Users sheet
    if ('users' in report) {
      sheets['Users'] = report.users.map((user) => ({
        'First Name': user.firstName || '',
        'Last Name': user.lastName || '',
        Email: user.userEmail,
        'IAM ID': user.iamId || '',
        'Total Cost': user.totalCost,
        'Resource Count': user.resourceCount,
      }));
    }

    // Top spenders sheet
    if ('topSpenders' in report) {
      sheets['Top Spenders'] = report.topSpenders.map((spender) => ({
        'First Name': spender.firstName || '',
        'Last Name': spender.lastName || '',
        Email: spender.userEmail,
        'IAM ID': spender.iamId || '',
        'Total Cost': spender.totalCost,
        'Resource Count': spender.resourceCount,
        'Percentage': spender.percentage,
      }));
    }

    // Cost breakdown by service
    if ('costBreakdown' in report) {
      sheets['By Service'] = report.costBreakdown.byService.map((item) => ({
        'Service Name': item.serviceName,
        'Cost': item.cost,
        'Percentage': item.percentage,
        'Resource Count': item.resourceCount,
      }));

      sheets['By Region'] = report.costBreakdown.byRegion.map((item) => ({
        'Region': item.region,
        'Cost': item.cost,
        'Percentage': item.percentage,
        'Resource Count': item.resourceCount,
      }));
    }

    this.exportAsExcel(sheets, filename);
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  /**
   * Download blob as file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename with timestamp
   */
  generateFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}-${timestamp}.${extension}`;
  }
}

// Export singleton instance
export const exportService = new ExportService();
export default exportService;

// Made with Bob
