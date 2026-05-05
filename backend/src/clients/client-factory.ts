import pLimit from 'p-limit';
import ResourceControllerV2 from '@ibm-cloud/platform-services/resource-controller/v2.js';
import ResourceManagerV2 from '@ibm-cloud/platform-services/resource-manager/v2.js';
import UsageReportsV4 from '@ibm-cloud/platform-services/usage-reports/v4.js';
import UserManagementV1 from '@ibm-cloud/platform-services/user-management/v1.js';

import { authService } from '../services/auth.service';
import { ibmCloudConfig } from '../config/ibm-cloud.config';
import type { CircuitBreakerConfig } from '../types/config.types';
import { ResourceControllerClient } from './resource-controller.client';
import { UsageReportsClient } from './usage-reports.client';
import { UserManagementClient } from './user-management.client';
import { CircuitBreakerError, IBMCloudError, RateLimitError } from '../utils/error-handler';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';

type AsyncOperation<T> = () => Promise<T>;

class SimpleCircuitBreaker {
  private failures = 0;

  private state: 'closed' | 'open' | 'half-open' = 'closed';

  private nextAttemptAt = 0;

  private halfOpenCalls = 0;

  public constructor(private readonly config: CircuitBreakerConfig) {}

  public async execute<T>(operation: AsyncOperation<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptAt) {
        throw new CircuitBreakerError('Circuit breaker is open', {
          operation: 'client.execute',
        });
      }

      this.state = 'half-open';
      this.halfOpenCalls = 0;
    }

    if (this.state === 'half-open' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerError('Circuit breaker half-open call limit reached', {
        operation: 'client.execute',
      });
    }

    if (this.state === 'half-open') {
      this.halfOpenCalls += 1;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    this.halfOpenCalls = 0;
  }

  private onFailure(): void {
    this.failures += 1;

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextAttemptAt = Date.now() + this.config.recoveryTimeoutMs;
    }
  }
}

export class ClientFactory {
  private readonly limiter = pLimit(ibmCloudConfig.rateLimit.concurrency);

  private readonly breaker = new SimpleCircuitBreaker(ibmCloudConfig.circuitBreaker);

  private readonly inflightRequests = new Map<string, Promise<unknown>>();

  /**
   * Creates a Resource Controller client wrapper.
   */
  public createResourceControllerClient(): ResourceControllerClient {
    if (!ibmCloudConfig.apiKey) {
      throw new Error(
        'IBM_CLOUD_API_KEY environment variable is not set. ' +
        'Please configure your IBM Cloud API key in the .env file.'
      );
    }

    const resourceController = new ResourceControllerV2({
      authenticator: authService.getAuthenticator(),
      serviceUrl: ibmCloudConfig.resourceControllerUrl,
      enableRetries: true,
      maxRetries: ibmCloudConfig.retry.attempts,
      timeout: ibmCloudConfig.timeoutMs,
    });

    const resourceManager = new ResourceManagerV2({
      authenticator: authService.getAuthenticator(),
      serviceUrl: 'https://resource-controller.cloud.ibm.com',
      enableRetries: true,
      maxRetries: ibmCloudConfig.retry.attempts,
      timeout: ibmCloudConfig.timeoutMs,
    });

    return new ResourceControllerClient(resourceController, resourceManager);
  }

  /**
   * Creates a Usage Reports client wrapper.
   */
  public createUsageReportsClient(): UsageReportsClient {
    const client = new UsageReportsV4({
      authenticator: authService.getAuthenticator(),
      serviceUrl: ibmCloudConfig.usageReportsUrl,
      enableRetries: true,
      maxRetries: ibmCloudConfig.retry.attempts,
    });

    return new UsageReportsClient(client);
  }

  /**
   * Creates a User Management client wrapper.
   */
  public createUserManagementClient(): UserManagementClient {
    const client = new UserManagementV1({
      authenticator: authService.getAuthenticator(),
      serviceUrl: 'https://user-management.cloud.ibm.com',
      enableRetries: true,
      maxRetries: ibmCloudConfig.retry.attempts,
    });

    return new UserManagementClient(client);
  }

  /**
   * Executes a deduplicated, rate-limited, retried operation.
   */
  public async executeWithResilience<T>(key: string, operation: AsyncOperation<T>): Promise<T> {
    const existing = this.inflightRequests.get(key) as Promise<T> | undefined;

    if (existing) {
      logger.debug({ key, cacheHit: true }, 'Reusing inflight request');
      return existing;
    }

    const startedAt = performance.now();
    const promise = this.limiter(() =>
      this.breaker.execute(async () =>
        withRetry(
          async () => {
            try {
              await authService.getValidToken();
              return await operation();
            } catch (error) {
              if (error instanceof Error && 'status' in error && Number(error.status) === 429) {
                throw new RateLimitError('IBM Cloud API rate limit exceeded', {
                  operation: 'client.executeWithResilience',
                  statusCode: 429,
                  cause: error,
                });
              }

              throw new IBMCloudError('IBM Cloud client operation failed', {
                operation: 'client.executeWithResilience',
                cause: error,
              });
            }
          },
          ibmCloudConfig.retry,
          {
            operation: key,
            service: 'ibm-cloud-sdk',
          },
        ),
      ),
    ).finally(() => {
      this.inflightRequests.delete(key);
      logger.info(
        {
          key,
          durationMs: Number((performance.now() - startedAt).toFixed(2)),
        },
        'Client operation completed',
      );
    });

    this.inflightRequests.set(key, promise);
    return promise;
  }
}

export const clientFactory = new ClientFactory();

// Made with Bob
