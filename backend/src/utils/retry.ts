import pRetry, { AbortError } from 'p-retry';

import type { RetryConfig } from '../types/config.types';
import { RateLimitError } from './error-handler';
import { logger } from './logger';

export interface RetryExecutionContext {
  readonly operation: string;
  readonly service?: string;
}

export const shouldRetry = (error: unknown): boolean => {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof Error) {
    return !('statusCode' in error) || ![400, 401, 403, 404].includes(Number(error.statusCode));
  }

  return true;
};

/**
 * Executes an async operation with exponential backoff retry behavior.
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  context: RetryExecutionContext,
): Promise<T> =>
  pRetry(
    async (attemptNumber) => {
      try {
        return await operation();
      } catch (error) {
        logger.warn(
          {
            attemptNumber,
            operation: context.operation,
            service: context.service,
            error,
          },
          'Retryable operation failed',
        );

        if (!shouldRetry(error)) {
          throw new AbortError(error instanceof Error ? error.message : 'Non-retryable failure');
        }

        throw error instanceof Error ? error : new Error('Retry failed with unknown error');
      }
    },
    {
      retries: Math.max(config.attempts - 1, 0),
      factor: config.factor,
      minTimeout: config.minTimeoutMs,
      maxTimeout: config.maxTimeoutMs,
    },
  );

// Made with Bob
