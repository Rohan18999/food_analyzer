import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as healthController from '../controllers/health.controller.js';

const router = Router();

router.get('/', healthController.getHealth);
router.get('/ready', asyncHandler(healthController.getReady));

export default router;
