import { Router } from 'express';
import analysisRoutes from './analysis.routes.js';
import healthRoutes from './health.routes.js';
import foodRoutes from './food.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/analysis', analysisRoutes);
router.use('/food', foodRoutes);

export default router;
