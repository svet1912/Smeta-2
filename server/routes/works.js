/**
 * Works Routes
 * Маршруты для работы с работами и их материалами
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import catalogController from '../controllers/catalogControllerOptimized.js';

const router = express.Router();

// ============ PUBLIC WORKS ROUTES ============
// Эти маршруты не требуют авторизации
router.get('/', catalogController.getWorks);

// ============ PROTECTED WORKS ROUTES ============
// Применяем middleware авторизации ко всем последующим маршрутам
router.use(authMiddleware);

// Управление работами
router.post('/', catalogController.createWork);
router.get('/:workId/materials', catalogController.getWorkMaterials);
router.post('/:workId/materials', catalogController.addWorkMaterial);
router.put('/:workId/materials/:materialId', catalogController.updateWorkMaterial);
router.delete('/:workId/materials/:materialId', catalogController.deleteWorkMaterial);

export default router;
