/**
 * Customer Estimates Routes
 * Маршруты для работы со сметами заказчика
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import customerEstimateController from '../controllers/customerEstimateController.js';

const router = express.Router();

// Применяем middleware авторизации ко всем маршрутам смет
router.use(authMiddleware);

// ============ CUSTOMER ESTIMATES ============
router.get('/', customerEstimateController.getAllCustomerEstimates);
router.post('/', customerEstimateController.createCustomerEstimate);
router.get('/:id', customerEstimateController.getCustomerEstimateById);
router.put('/:id', customerEstimateController.updateCustomerEstimate);
router.delete('/:id', customerEstimateController.deleteCustomerEstimate);

// ============ ESTIMATE ITEMS ============
router.get('/:estimateId/items', customerEstimateController.getEstimateItems);
router.post('/:estimateId/items', customerEstimateController.addEstimateItem);
router.put('/:estimateId/items/:itemId', customerEstimateController.updateEstimateItem);
router.delete('/:estimateId/items/:itemId', customerEstimateController.deleteEstimateItem);

// ============ ESTIMATE HISTORY ============
router.get('/:estimateId/history', customerEstimateController.getEstimateHistory);

// ============ ESTIMATE TEMPLATES ============
router.get('/templates', customerEstimateController.getEstimateTemplates);
router.post('/templates', customerEstimateController.createEstimateTemplate);

export default router;
