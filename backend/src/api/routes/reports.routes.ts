import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import {
  GenerateUserSpendingRequestSchema,
  GenerateTeamSpendingRequestSchema,
} from '../schemas/report.schemas';
import { ReportIdParamSchema } from '../schemas/query.schemas';

const router = Router();

/**
 * GET /api/reports
 * List all stored reports
 */
router.get(
  '/',
  rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }), // 100 requests per minute
  (req, res, next) => reportsController.listReports(req, res, next),
);

/**
 * POST /api/reports/user-spending
 * Generate a user spending report
 */
router.post(
  '/user-spending',
  rateLimitMiddleware({ maxRequests: 10, windowMs: 60000 }), // 10 requests per minute
  validateRequest({ body: GenerateUserSpendingRequestSchema }),
  (req, res, next) => reportsController.generateUserSpendingReport(req, res, next),
);

/**
 * POST /api/reports/team-spending
 * Generate a team spending report
 */
router.post(
  '/team-spending',
  rateLimitMiddleware({ maxRequests: 10, windowMs: 60000 }), // 10 requests per minute
  validateRequest({ body: GenerateTeamSpendingRequestSchema }),
  (req, res, next) => reportsController.generateTeamSpendingReport(req, res, next),
);

/**
 * GET /api/reports/:reportId
 * Get a generated report by ID
 */
router.get(
  '/:reportId',
  rateLimitMiddleware({ maxRequests: 100, windowMs: 60000 }), // 100 requests per minute
  validateRequest({ params: ReportIdParamSchema }),
  (req, res, next) => reportsController.getReport(req, res, next),
);

/**
 * GET /api/reports/:reportId/download
 * Download a report in specified format
 */
router.get(
  '/:reportId/download',
  rateLimitMiddleware({ maxRequests: 50, windowMs: 60000 }), // 50 requests per minute
  validateRequest({ params: ReportIdParamSchema }),
  (req, res, next) => reportsController.downloadReport(req, res, next),
);

export default router;

// Made with Bob