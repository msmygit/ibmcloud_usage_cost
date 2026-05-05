/**
 * Validation Utilities
 * Functions for validating form inputs and data
 */

import type { DateRange, ReportFilters } from '../types/api.types';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date range
 */
export function isValidDateRange(dateRange: DateRange): {
  valid: boolean;
  error?: string;
} {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Invalid start date' };
  }

  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid end date' };
  }

  if (start > end) {
    return { valid: false, error: 'Start date must be before end date' };
  }

  // Check if range is not too large (e.g., max 2 years)
  const maxDays = 730; // 2 years
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff > maxDays) {
    return { valid: false, error: 'Date range cannot exceed 2 years' };
  }

  return { valid: true };
}

/**
 * Validate report filters
 */
export function validateReportFilters(filters: ReportFilters): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate user emails
  if (filters.userEmails && filters.userEmails.length > 0) {
    const invalidEmails = filters.userEmails.filter((email) => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }
  }

  // Validate cost range
  if (filters.minCost !== undefined && filters.maxCost !== undefined) {
    if (filters.minCost < 0) {
      errors.push('Minimum cost cannot be negative');
    }
    if (filters.maxCost < 0) {
      errors.push('Maximum cost cannot be negative');
    }
    if (filters.minCost > filters.maxCost) {
      errors.push('Minimum cost cannot be greater than maximum cost');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate account ID format
 */
export function isValidAccountId(accountId: string): boolean {
  // IBM Cloud account IDs are typically 32-character hex strings
  const accountIdRegex = /^[a-f0-9]{32}$/i;
  return accountIdRegex.test(accountId);
}

/**
 * Validate month format (YYYY-MM)
 */
export function isValidMonthFormat(month: string): boolean {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return monthRegex.test(month);
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate file name
 */
export function isValidFileName(fileName: string): boolean {
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
  return !invalidChars.test(fileName) && fileName.length > 0 && fileName.length <= 255;
}

/**
 * Validate number range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Check if string is not empty
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validate array has items
 */
export function hasItems<T>(array: T[]): boolean {
  return Array.isArray(array) && array.length > 0;
}

// Made with Bob
