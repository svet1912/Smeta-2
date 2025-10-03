/**
 * Catalog Routes
 * Маршруты для работы с каталогами материалов и работ
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import catalogController from '../controllers/catalogControllerOptimized.js';

const router = express.Router();

// ============ PUBLIC CATALOG ROUTES ============
// Эти маршруты не требуют авторизации (публичные каталоги)
// Обработка маршрутов без префикса (например, /materials -> /)
router.get('/', catalogController.getMaterials);
router.get('/works', catalogController.getWorks);
router.get('/phases', catalogController.getPhases);
router.get('/work-materials', catalogController.getWorkMaterials);

// ============ PROTECTED CATALOG ROUTES ============
// Применяем middleware авторизации ко всем последующим маршрутам
router.use(authMiddleware);

// Управление материалами (для /materials префикса)
router.post('/', catalogController.createMaterial);
router.put('/:id', catalogController.updateMaterial);
router.delete('/:id', catalogController.deleteMaterial);

export default router;
