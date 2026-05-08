import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

import type { AppEnvironment, EnvironmentConfig } from '../types/config.types';

loadDotEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('localhost'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  IBM_CLOUD_API_KEY: z
    .string()
    .min(40, 'IBM_CLOUD_API_KEY must be at least 40 characters long')
    .describe('IBM Cloud API Key is required for authentication'),
  IBM_CLOUD_ACCOUNT_ID: z.string().min(1).optional(),
  IBM_CLOUD_ACCOUNT_NAME: z.string().min(1).optional(),
  IBM_CLOUD_REGION: z.string().min(1).default('us-south'),
  IBM_CLOUD_IAM_URL: z.string().url().optional(),
  IBM_CLOUD_RESOURCE_CONTROLLER_URL: z
    .string()
    .url()
    .default('https://resource-controller.cloud.ibm.com'),
  IBM_CLOUD_USAGE_REPORTS_URL: z.string().url().default('https://billing.cloud.ibm.com'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  REQUEST_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  REQUEST_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(1000),
  MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).max(100).default(10),
  TOKEN_REFRESH_BUFFER_MS: z.coerce.number().int().min(1000).default(300000),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(5),
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS: z.coerce.number().int().min(1).default(2),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
  COMPRESSION_ENABLED: z.coerce.boolean().default(true),
  COMPRESSION_LEVEL: z.coerce.number().int().min(0).max(9).default(6),
  WEBSOCKET_ENABLED: z.coerce.boolean().default(true),
  WEBSOCKET_PATH: z.string().min(1).default('/socket.io'),
  REQUEST_ID_HEADER: z.string().min(1).default('x-request-id'),
});

export type RawEnvironment = z.infer<typeof envSchema>;

export class EnvironmentValidationError extends Error {
  public readonly issues: string[];

  public constructor(issues: string[]) {
    super(`Environment validation failed: ${issues.join(', ')}`);
    this.name = 'EnvironmentValidationError';
    this.issues = issues;
  }
}

export const parseEnvironment = (
  source: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig => {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new EnvironmentValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  const env = result.data;

  return {
    server: {
      nodeEnv: env.NODE_ENV as AppEnvironment,
      host: env.HOST,
      port: env.PORT,
      corsOrigin: env.CORS_ORIGIN.split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      corsCredentials: env.CORS_CREDENTIALS,
      requestIdHeader: env.REQUEST_ID_HEADER,
      logLevel: env.LOG_LEVEL,
      logPretty: env.LOG_PRETTY,
      compressionEnabled: env.COMPRESSION_ENABLED,
      compressionLevel: env.COMPRESSION_LEVEL,
      websocketEnabled: env.WEBSOCKET_ENABLED,
      websocketPath: env.WEBSOCKET_PATH,
    },
    ibmCloud: {
      apiKey: env.IBM_CLOUD_API_KEY,
      accountId: env.IBM_CLOUD_ACCOUNT_ID,
      accountName: env.IBM_CLOUD_ACCOUNT_NAME,
      region: env.IBM_CLOUD_REGION,
      iamUrl: env.IBM_CLOUD_IAM_URL,
      resourceControllerUrl: env.IBM_CLOUD_RESOURCE_CONTROLLER_URL,
      usageReportsUrl: env.IBM_CLOUD_USAGE_REPORTS_URL,
      timeoutMs: env.REQUEST_TIMEOUT_MS,
      retry: {
        attempts: env.REQUEST_RETRY_ATTEMPTS,
        minTimeoutMs: env.REQUEST_RETRY_DELAY_MS,
        maxTimeoutMs: env.REQUEST_RETRY_DELAY_MS * 4,
        factor: 2,
      },
      rateLimit: {
        concurrency: env.MAX_CONCURRENT_REQUESTS,
      },
      tokenRefreshBufferMs: env.TOKEN_REFRESH_BUFFER_MS,
      circuitBreaker: {
        failureThreshold: env.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        recoveryTimeoutMs: env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
        halfOpenMaxCalls: env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS,
      },
    },
  };
};

export const environmentConfig = parseEnvironment();

// Made with Bob
