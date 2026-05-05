import React from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ReportProgressPayload } from '../../types/websocket.types';

interface ProgressIndicatorProps {
  progress: ReportProgressPayload | null;
  onCancel?: () => void;
  className?: string;
}

export function ProgressIndicator({
  progress,
  onCancel,
  className,
}: ProgressIndicatorProps) {
  if (!progress) {
    return null;
  }

  const { progress: percentage, currentStep, estimatedTimeRemaining, status } = progress;

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-blue-600';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-lg border border-gray-200 p-6',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          {getStatusIcon()}
          <h3 className="ml-2 text-lg font-semibold text-gray-900">
            {status === 'completed' && 'Report Complete'}
            {status === 'failed' && 'Report Failed'}
            {status === 'processing' && 'Generating Report'}
            {status === 'pending' && 'Report Pending'}
          </h3>
        </div>
        
        {status === 'processing' && onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cancel report generation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {currentStep}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {Math.round(percentage)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={clsx(
              'h-2.5 rounded-full transition-all duration-300 ease-out',
              getStatusColor()
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Estimated Time */}
      {status === 'processing' && estimatedTimeRemaining !== undefined && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Estimated time remaining:</span>
          <span className="font-medium">
            {formatTime(estimatedTimeRemaining)}
          </span>
        </div>
      )}

      {/* Status Messages */}
      {status === 'completed' && (
        <p className="text-sm text-green-600 mt-2">
          Report generated successfully! You can now view and export it.
        </p>
      )}
      
      {status === 'failed' && (
        <p className="text-sm text-red-600 mt-2">
          Failed to generate report. Please try again or contact support.
        </p>
      )}
    </div>
  );
}

// Compact version for inline display
export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const percentage = (value / max) * 100;

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-semibold text-gray-900">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Made with Bob
