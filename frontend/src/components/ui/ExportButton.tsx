import React, { useState } from 'react';
import { Download, FileImage, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { clsx } from 'clsx';
import type { ExportFormat } from '../../types/chart.types';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => Promise<void>;
  formats?: ExportFormat[];
  disabled?: boolean;
  className?: string;
}

const formatIcons: Record<ExportFormat, React.ReactNode> = {
  png: <FileImage className="h-4 w-4" />,
  jpeg: <FileImage className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4" />,
  csv: <FileSpreadsheet className="h-4 w-4" />,
  excel: <FileSpreadsheet className="h-4 w-4" />,
  json: <FileJson className="h-4 w-4" />,
};

const formatLabels: Record<ExportFormat, string> = {
  png: 'PNG Image',
  jpeg: 'JPEG Image',
  pdf: 'PDF Document',
  csv: 'CSV File',
  excel: 'Excel Spreadsheet',
  json: 'JSON Data',
};

export function ExportButton({
  onExport,
  formats = ['png', 'pdf', 'csv', 'excel'],
  disabled = false,
  className,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setIsOpen(false);
    
    try {
      await onExport(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={clsx('relative inline-block', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={clsx(
          'inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium transition-colors',
          disabled || isExporting
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        )}
      >
        <Download className="h-4 w-4 mr-2" />
        {isExporting ? 'Exporting...' : 'Export'}
      </button>

      {isOpen && !disabled && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
            <div className="py-1" role="menu">
              {formats.map((format) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex items-center transition-colors"
                  role="menuitem"
                >
                  <span className="mr-3 text-gray-400">
                    {formatIcons[format]}
                  </span>
                  {formatLabels[format]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Compact version for inline use
export function ExportIconButton({
  onExport,
  format,
  disabled = false,
  className,
}: {
  onExport: (format: ExportFormat) => Promise<void>;
  format: ExportFormat;
  disabled?: boolean;
  className?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className={clsx(
        'p-2 rounded-md transition-colors',
        disabled || isExporting
          ? 'text-muted-foreground cursor-not-allowed'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        className
      )}
      title={`Export as ${formatLabels[format]}`}
    >
      {isExporting ? (
        <Download className="h-4 w-4 animate-pulse" />
      ) : (
        formatIcons[format]
      )}
    </button>
  );
}

// Made with Bob
