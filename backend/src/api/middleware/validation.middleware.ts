import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { AppError } from '../../utils/error-handler';
import { logger } from '../../utils/logger';

/**
 * Validation target
 */
interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validation error details
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Middleware factory for request validation using Zod schemas
 */
export function validateRequest(schemas: ValidationTarget) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = res.locals.requestId as string;
    const errors: ValidationErrorDetail[] = [];

    try {
      // Validate body
      if (schemas.body) {
        try {
          req.body = await schemas.body.parseAsync(req.body);
        } catch (error) {
          errors.push(...extractZodErrors(error as ZodError, 'body'));
        }
      }

      // Validate query
      if (schemas.query) {
        try {
          req.query = await schemas.query.parseAsync(req.query);
        } catch (error) {
          errors.push(...extractZodErrors(error as ZodError, 'query'));
        }
      }

      // Validate params
      if (schemas.params) {
        try {
          req.params = await schemas.params.parseAsync(req.params);
        } catch (error) {
          errors.push(...extractZodErrors(error as ZodError, 'params'));
        }
      }

      // If there are validation errors, throw
      if (errors.length > 0) {
        logger.warn(
          { requestId, errors, path: req.path },
          'Request validation failed',
        );

        throw new AppError(
          'Request validation failed',
          'VALIDATION_ERROR',
          400,
          { details: { errors } },
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Extracts validation errors from Zod error
 */
function extractZodErrors(error: ZodError, source: string): ValidationErrorDetail[] {
  return error.errors.map((err) => ({
    field: `${source}.${err.path.join('.')}`,
    message: err.message,
    value: err.code === 'invalid_type' ? undefined : err,
  }));
}

// Made with Bob