export type AppEnvironment = 'development' | 'test' | 'production';

export interface RetryConfig {
  readonly attempts: number;
  readonly minTimeoutMs: number;
  readonly maxTimeoutMs: number;
  readonly factor: number;
}

export interface RateLimitConfig {
  readonly concurrency: number;
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly recoveryTimeoutMs: number;
  readonly halfOpenMaxCalls: number;
}

export interface IBMCloudConfig {
  readonly apiKey: string;
  readonly accountId?: string;
  readonly region: string;
  readonly iamUrl?: string;
  readonly resourceControllerUrl: string;
  readonly usageReportsUrl: string;
  readonly timeoutMs: number;
  readonly retry: RetryConfig;
  readonly rateLimit: RateLimitConfig;
  readonly tokenRefreshBufferMs: number;
  readonly circuitBreaker: CircuitBreakerConfig;
}

export interface ServerConfig {
  readonly nodeEnv: AppEnvironment;
  readonly host: string;
  readonly port: number;
  readonly corsOrigin: string[];
  readonly corsCredentials: boolean;
  readonly requestIdHeader: string;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  readonly logPretty: boolean;
  readonly compressionEnabled: boolean;
  readonly compressionLevel: number;
  readonly websocketEnabled: boolean;
  readonly websocketPath: string;
}

export interface EnvironmentConfig {
  readonly server: ServerConfig;
  readonly ibmCloud: IBMCloudConfig;
}

// Made with Bob
