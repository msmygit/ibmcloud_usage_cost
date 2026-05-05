/**
 * Formatting Utilities
 * Functions for formatting currency, dates, numbers, and other data
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format currency value
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  // Ensure currency code is valid (not empty or undefined)
  const validCurrency = currency && currency.trim() !== '' ? currency : 'USD';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: validCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatNumber(value: number, decimals: number = 1): string {
  if (value === 0) return '0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  }
  
  return `${sign}${absValue.toFixed(decimals)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string, formatStr: string = 'MMM dd, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Format month string (YYYY-MM) to readable format
 */
export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  if (!year || !monthNum) return month;
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return format(date, 'MMM yyyy');
}

/**
 * Format duration in seconds to readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Format file size in bytes to readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Format email to display name (extract name part before @)
 */
export function formatEmailToName(email: string): string {
  const namePart = email.split('@')[0];
  if (!namePart) return email;
  return namePart
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Format growth rate with sign
 */
export function formatGrowthRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

/**
 * Format report status to display text
 */
export function formatReportStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format array to comma-separated string
 */
export function formatList(items: string[], maxItems: number = 3): string {
  if (items.length === 0) return 'None';
  if (items.length <= maxItems) return items.join(', ');
  
  const visible = items.slice(0, maxItems);
  const remaining = items.length - maxItems;
  return `${visible.join(', ')} +${remaining} more`;
}

/**
 * Format cost trend indicator
 */
export function formatTrendIndicator(trend: 'increasing' | 'decreasing' | 'stable'): {
  text: string;
  color: string;
  icon: string;
} {
  switch (trend) {
    case 'increasing':
      return { text: 'Increasing', color: 'text-red-600', icon: '↑' };
    case 'decreasing':
      return { text: 'Decreasing', color: 'text-green-600', icon: '↓' };
    case 'stable':
      return { text: 'Stable', color: 'text-gray-600', icon: '→' };
  }
}

// Made with Bob
