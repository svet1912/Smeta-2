/**
 * Главный централизованный роутер для всех API endpoints
 * Модульная архитектура с разделением по функциональности
 */
import express from 'express';
import { connectionLimiterMiddleware } from '../middleware/connectionLimiter.js';

// Импорт модульных роутеров
import authRoutes from './auth.js';
import catalogRoutes from './catalog.js';
import phasesRoutes from './phases.js';
import workMaterialsRoutes from './workMaterials.js';
import worksRoutes from './works.js';
import estimatesRoutes from './estimates.js';
import projectsRoutes from './projects.js';
import leadsRoutes from './leads.js';
import systemRoutes from './system.js';

const router = express.Router();

// Применяем middleware для всех маршрутов
router.use(connectionLimiterMiddleware);

// ============ MODULE ROUTES ============
// Подключаем модульные роутеры с соответствующими префиксами

// Системные маршруты (health, metrics, cache) - ПЕРВЫМИ
router.use('/', systemRoutes);

// Маршруты лидов (публичные)
router.use('/leads', leadsRoutes);

// Маршруты аутентификации
router.use('/auth', authRoutes);

// Маршруты каталогов (материалы, работы) - КОНКРЕТНЫЕ ПРЕФИКСЫ
router.use('/materials', catalogRoutes);
router.use('/phases', phasesRoutes);
router.use('/works', worksRoutes);
router.use('/work-materials', workMaterialsRoutes);

// Маршруты смет заказчика
router.use('/customer-estimates', estimatesRoutes);

// Маршруты проектов
router.use('/projects', projectsRoutes);

export default router;
