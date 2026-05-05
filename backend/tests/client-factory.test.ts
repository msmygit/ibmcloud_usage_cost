import { describe, expect, it } from 'vitest';

import { IBMCloudError } from '../src/utils/error-handler';
import { withRetry } from '../src/utils/retry';

describe('client resilience primitives', () => {
  it('deduplicates inflight operations by shared promise usage pattern', async () => {
    let executions = 0;
    let inflight: Promise<string> | null = null;

    const operation = async (): Promise<string> => {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'ok';
    };

    const executeWithDeduplication = (): Promise<string> => {
      if (inflight) {
        return inflight;
      }

      inflight = operation().finally(() => {
        inflight = null;
      });

      return inflight;
    };

    const [first, second] = await Promise.all([
      executeWithDeduplication(),
      executeWithDeduplication(),
    ]);

    expect(first).toBe('ok');
    expect(second).toBe('ok');
    expect(executions).toBe(1);
  });

  it('retries retryable IBM Cloud failures', async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;

        if (attempts < 2) {
          throw new IBMCloudError('temporary failure', { statusCode: 502 });
        }

        return 'ok';
      },
      {
        attempts: 3,
        minTimeoutMs: 1,
        maxTimeoutMs: 5,
        factor: 2,
      },
      { operation: 'test.operation', service: 'test' },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });
});

// Made with Bob
