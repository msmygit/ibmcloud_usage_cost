export interface ErrorContext {
  readonly operation?: string;
  readonly service?: string;
  readonly statusCode?: number;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;

  public constructor(
    message: string,
    code = 'APP_ERROR',
    statusCode = 500,
    context: ErrorContext = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = true;
  }
}

export class IBMCloudError extends AppError {
  public constructor(message: string, context: ErrorContext = {}) {
    super(message, 'IBM_CLOUD_ERROR', context.statusCode ?? 502, context);
  }
}

export class AuthenticationError extends AppError {
  public constructor(message: string, context: ErrorContext = {}) {
    super(message, 'AUTHENTICATION_ERROR', context.statusCode ?? 401, context);
  }
}

export class RateLimitError extends AppError {
  public constructor(message: string, context: ErrorContext = {}) {
    super(message, 'RATE_LIMIT_ERROR', context.statusCode ?? 429, context);
  }
}

export class CircuitBreakerError extends AppError {
  public constructor(message: string, context: ErrorContext = {}) {
    super(message, 'CIRCUIT_BREAKER_OPEN', context.statusCode ?? 503, context);
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const normalizeError = (error: unknown, fallbackMessage = 'Unexpected error'): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message || fallbackMessage, 'UNEXPECTED_ERROR', 500, {
      cause: error,
    });
  }

  return new AppError(fallbackMessage, 'UNKNOWN_ERROR', 500, { cause: error });
};

// Made with Bob
