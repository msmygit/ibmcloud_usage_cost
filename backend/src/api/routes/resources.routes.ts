import { Router } from 'express';
import type { ResourcesController } from '../controllers/resources.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { ResourcesQuerySchema, AccountIdParamSchema } from '../schemas/query.schemas';
import { z } from 'zod';

/**
 * Creates resources routes
 * @param controller - Resources controller instance
 * @returns Express router
 */
export function createResourcesRoutes(controller: ResourcesController): Router {
  const router = Router();

  /**
   * GET /api/resources
   * Lists all resources for an account
   * Query params:
   * - accountId (required): IBM Cloud account ID
   * - resourceGroupId (optional): Filter by resource group
   */
  router.get(
    '/',
    validateRequest({
      query: ResourcesQuerySchema,
    }),
    (req, res, next) => controller.listResources(req, res, next)
  );

  /**
   * GET /api/resources/:resourceId
   * Gets details for a specific resource
   * Query params:
   * - accountId (required): IBM Cloud account ID
   */
  router.get(
    '/:resourceId',
    validateRequest({
      params: z.object({
        resourceId: z.string().min(1, 'Resource ID is required'),
      }),
      query: AccountIdParamSchema,
    }),
    (req, res, next) => controller.getResource(req, res, next)
  );

  return router;
}

// Made with Bob