/**
 * Authentication Routes
 * Маршруты для аутентификации и авторизации
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimiting.js';
import authController from '../controllers/authController.js';

const router = express.Router();

// ============ PUBLIC AUTH ROUTES ============
// Эти маршруты не требуют авторизации, но имеют rate limiting
router.post('/login', authRateLimit, authController.login);
// TODO: Реализовать регистрацию
// router.post('/register', authRateLimit, authController.register);

// ============ PROTECTED AUTH ROUTES ============
// Применяем middleware авторизации ко всем последующим маршрутам
router.use(authMiddleware);

router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);
router.get('/me', authController.getCurrentUserInfo);
router.get('/tenants', authController.getUserTenants);
router.post('/switch-tenant', authController.switchTenant);

export default router;
