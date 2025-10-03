/**
 * Work Materials Routes
 * Маршруты для работы с материалами работ
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import catalogController from '../controllers/catalogControllerOptimized.js';

const router = express.Router();

// ============ PUBLIC WORK MATERIALS ROUTES ============
// Получение списка материалов работ (публичный доступ)
router.get('/', catalogController.getWorkMaterials);

// ============ PROTECTED WORK MATERIALS ROUTES ============
// Применяем middleware авторизации ко всем последующим маршрутам
router.use(authMiddleware);

// Управление материалами работ (требует авторизации)
// router.post('/', catalogController.createWorkMaterial);
// router.put('/:id', catalogController.updateWorkMaterial);
// router.delete('/:id', catalogController.deleteWorkMaterial);

export default router;
