/**
 * Projects Routes
 * Маршруты для работы с проектами и объектными параметрами
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import profileController from '../controllers/profileController.js';

const router = express.Router();

// Применяем middleware авторизации ко всем маршрутам проектов
router.use(authMiddleware);

// ============ PROJECTS ============
router.get('/', profileController.getUserProjects);
router.post('/', profileController.createProject);
// TODO: Реализовать остальные методы проектов
// router.get('/:id', profileController.getProject);
// router.put('/:id', profileController.updateProject);
// router.delete('/:id', profileController.deleteProject);

// ============ OBJECT PARAMETERS ============
// TODO: Реализовать маршруты для объектных параметров
// router.get('/:projectId/object-parameters', profileController.getObjectParameters);
// router.post('/:projectId/object-parameters', profileController.createObjectParameters);

// ============ ROOMS ============
// TODO: Реализовать маршруты для помещений
// router.get('/:projectId/object-parameters/:objectParamsId/rooms', profileController.getRooms);
// router.post('/:projectId/object-parameters/:objectParamsId/rooms', profileController.createRoom);
// router.put('/:projectId/rooms/:roomId', profileController.updateRoom);
// router.delete('/:projectId/rooms/:roomId', profileController.deleteRoom);

// ============ CONSTRUCTIVE ELEMENTS ============
// TODO: Реализовать маршруты для конструктивных элементов
// router.get('/:projectId/object-parameters/:objectParamsId/constructive-elements', profileController.getConstructiveElements);
// router.post('/:projectId/object-parameters/:objectParamsId/constructive-elements', profileController.createConstructiveElement);
// router.put('/:projectId/constructive-elements/:elementId', profileController.updateConstructiveElement);
// router.delete('/:projectId/constructive-elements/:elementId', profileController.deleteConstructiveElement);

// ============ ENGINEERING SYSTEMS ============
// TODO: Реализовать маршруты для инженерных систем
// router.get('/:projectId/object-parameters/:objectParamsId/engineering-systems', profileController.getEngineeringSystems);
// router.post('/:projectId/object-parameters/:objectParamsId/engineering-systems', profileController.createEngineeringSystem);
// router.put('/:projectId/engineering-systems/:systemId', profileController.updateEngineeringSystem);
// router.delete('/:projectId/engineering-systems/:systemId', profileController.deleteEngineeringSystem);

export default router;
