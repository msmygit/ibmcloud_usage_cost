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
   * GET /api/resources/by-creator
   * Lists all active resources grouped by creator
   * Query params:
   * - accountId (required): IBM Cloud account ID
   * - state (optional): Filter by resource state (default: 'active')
   * Note: This route must come before /:resourceId to avoid conflicts
   */
  router.get(
    '/by-creator',
    validateRequest({
      query: z.object({
        accountId: z.string().optional(),
        state: z.string().optional(),
      }),
    }),
    (req, res, next) => controller.listResourcesByCreator(req, res, next)
  );

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
   * POST /api/resources/details
   * Gets detailed information for multiple resources
   * Body:
   * - resourceIds: Array of resource IDs
   */
  router.post(
    '/details',
    validateRequest({
      body: z.object({
        resourceIds: z.array(z.string()).min(1, 'At least one resource ID is required'),
      }),
    }),
    (req, res, next) => controller.getResourceDetails(req, res, next)
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