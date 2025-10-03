/**
 * Phases Routes
 * Маршруты для работы с фазами
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import catalogController from '../controllers/catalogControllerOptimized.js';

const router = express.Router();

// ============ PUBLIC PHASES ROUTES ============
// Получение списка фаз (публичный доступ)
router.get('/', catalogController.getPhases);

// ============ PROTECTED PHASES ROUTES ============
// Применяем middleware авторизации ко всем последующим маршрутам
router.use(authMiddleware);

// Управление фазами (требует авторизации)
// router.post('/', catalogController.createPhase);
// router.put('/:id', catalogController.updatePhase);
// router.delete('/:id', catalogController.deletePhase);

export default router;
