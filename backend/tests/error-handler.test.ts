import { describe, expect, it } from 'vitest';

import {
  AppError,
  AuthenticationError,
  RateLimitError,
  normalizeError,
} from '../src/utils/error-handler';

describe('error-handler', () => {
  it('preserves app errors during normalization', () => {
    const error = new AuthenticationError('auth failed');
    expect(normalizeError(error)).toBe(error);
  });

  it('wraps standard errors', () => {
    const normalized = normalizeError(new Error('boom'));
    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.message).toBe('boom');
  });

  it('creates rate limit error with 429 status', () => {
    const error = new RateLimitError('too many requests');
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_ERROR');
  });
});

// Made with Bob
