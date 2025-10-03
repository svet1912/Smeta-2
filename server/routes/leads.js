/**
 * Leads Routes
 * Маршруты для работы с лидами (заявками)
 */
import express from 'express';
import { leadRateLimit } from '../middleware/rateLimiting.js';
import leadController from '../controllers/leadController.js';

const router = express.Router();

// ============ PUBLIC LEAD ROUTES ============
// Эти маршруты не требуют авторизации, но имеют rate limiting
router.get('/', leadController.getLeads);
router.post('/', leadRateLimit, leadController.createLead);
router.get('/stats', leadController.getLeadsStats);

export default router;
