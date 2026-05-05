import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/error-handler';
import { logger } from '../../utils/logger';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limit store
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Increments the request count for a key
   */
  public increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return entry;
  }

  /**
   * Gets the current count for a key
   */
  public get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime >= Date.now()) {
      return entry;
    }
    return undefined;
  }

  /**
   * Resets the count for a key
   */
  public reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleans up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Rate limit store cleanup completed');
    }
  }

  /**
   * Shuts down the store
   */
  public shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limiting middleware factory
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const requestId = res.locals.requestId as string;

    try {
      // Get current rate limit status
      const { count, resetTime } = rateLimitStore.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

      // Check if rate limit exceeded
      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn(
          {
            requestId,
            key,
            count,
            maxRequests,
            path: req.path,
          },
          'Rate limit exceeded',
        );

        throw new AppError(
          'Too many requests, please try again later',
          'RATE_LIMIT_EXCEEDED',
          429,
          {
            details: {
              limit: maxRequests,
              remaining: 0,
              reset: resetTime,
              retryAfter,
            },
          },
        );
      }

      // Handle response completion for conditional counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        res.on('finish', () => {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Decrement count if we should skip this request
            const entry = rateLimitStore.get(key);
            if (entry && entry.count > 0) {
              entry.count--;
            }
          }
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Resets rate limit for a specific key
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.reset(key);
}

/**
 * Shuts down the rate limit store
 */
export function shutdownRateLimitStore(): void {
  rateLimitStore.shutdown();
}

// Made with Bob