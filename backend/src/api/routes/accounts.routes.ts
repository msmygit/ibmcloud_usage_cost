import { Router } from 'express';
import { AccountsController } from '../controllers/accounts.controller';

const router = Router();

/**
 * @route GET /api/accounts/test
 * @desc Test IBM Cloud connection
 */
router.get('/test', AccountsController.testConnection);

/**
 * @route GET /api/accounts
 * @desc Get list of accessible IBM Cloud accounts
 */
router.get('/', AccountsController.listAccounts);

export default router;

// Made with Bob
