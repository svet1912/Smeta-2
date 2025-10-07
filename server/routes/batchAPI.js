/**
 * Batch API Endpoints
 * Phase 3 Step 2: API Performance Optimization
 * 
 * Batch processing для множественных API запросов
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getAPIOptimizer } from '../services/apiOptimizer.js';
import { getDatabaseManager } from '../database/advancedPool.js';

const router = express.Router();
const apiOptimizer = getAPIOptimizer();
const dbManager = getDatabaseManager();

/**
 * Batch API Request Handler
 * POST /api/batch
 * 
 * Принимает массив запросов и обрабатывает их как единую операцию
 */
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Invalid batch request format',
        code: 'INVALID_BATCH_FORMAT'
      });
    }
    
    if (requests.length > 100) {
      return res.status(400).json({
        error: 'Batch size limit exceeded (max 100 requests)',
        code: 'BATCH_SIZE_LIMIT'
      });
    }
    
    console.log(`🚀 Processing batch request with ${requests.length} operations`);
    
    // Add user context to each request
    const contextualRequests = requests.map((req, index) => ({
      id: req.id || `batch_${index}`,
      method: req.method || 'GET',
      path: req.path,
      params: req.params || {},
      query: req.query || {},
      body: req.body || {},
      user: req.user,
      tenantId: req.user?.tenantId
    }));
    
    // Process batch
    const results = await apiOptimizer.processBatch(contextualRequests);
    
    // Format response
    const response = {
      success: true,
      processed: results.length,
      timestamp: new Date().toISOString(),
      results: results.map(result => ({
        id: result.id,
        success: !result.error,
        data: result.data,
        error: result.error,
        cached: result.cached || false
      }))
    };
    
    console.log(`✅ Batch completed: ${results.length} operations processed`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Batch processing error:', error);
    res.status(500).json({
      error: 'Batch processing failed',
      code: 'BATCH_PROCESSING_ERROR',
      details: error.message
    });
  }
});

/**
 * Batch Materials Requests
 * POST /api/batch/materials
 */
router.post('/materials', authMiddleware, async (req, res) => {
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        error: 'Operations must be an array',
        code: 'INVALID_OPERATIONS_FORMAT'
      });
    }
    
    const results = [];
    const transaction = await dbManager.transaction();
    
    try {
      for (const operation of operations) {
        const { type, data, id } = operation;
        
        switch (type) {
          case 'create':
            const createResult = await transaction.query(
              `INSERT INTO materials (name, description, type, unit, price, category, is_active, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *`,
              [
                data.name,
                data.description,
                data.type,
                data.unit,
                data.price,
                data.category,
                data.isActive !== false,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'create',
              success: true,
              data: createResult.rows[0]
            });
            break;
            
          case 'update':
            const updateResult = await transaction.query(
              `UPDATE materials 
               SET name = $1, description = $2, type = $3, unit = $4, 
                   price = $5, category = $6, is_active = $7, updated_at = NOW()
               WHERE id = $8 AND tenant_id = $9
               RETURNING *`,
              [
                data.name,
                data.description,
                data.type,
                data.unit,
                data.price,
                data.category,
                data.isActive,
                id,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'update',
              success: updateResult.rowCount > 0,
              data: updateResult.rows[0] || null
            });
            break;
            
          case 'delete':
            const deleteResult = await transaction.query(
              'DELETE FROM materials WHERE id = $1 AND tenant_id = $2',
              [id, req.user.tenantId]
            );
            results.push({
              operation: 'delete',
              success: deleteResult.rowCount > 0,
              data: { id, deleted: deleteResult.rowCount > 0 }
            });
            break;
            
          default:
            results.push({
              operation: type,
              success: false,
              error: 'Unknown operation type'
            });
            break;
        }
      }
      
      await transaction.commit();
      
      res.json({
        success: true,
        processed: operations.length,
        results
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Batch materials error:', error);
    res.status(500).json({
      error: 'Batch materials operation failed',
      code: 'BATCH_MATERIALS_ERROR',
      details: error.message
    });
  }
});

/**
 * Batch Works Requests
 * POST /api/batch/works
 */
router.post('/works', authMiddleware, async (req, res) => {
  try {
    const { operations } = req.body;
    const results = [];
    const transaction = await dbManager.transaction();
    
    try {
      for (const operation of operations) {
        const { type, data, id } = operation;
        
        switch (type) {
          case 'create':
            const createResult = await transaction.query(
              `INSERT INTO works (name, description, unit, base_price, category, phase_id, is_active, tenant_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *`,
              [
                data.name,
                data.description,
                data.unit,
                data.basePrice,
                data.category,
                data.phaseId,
                data.isActive !== false,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'create',
              success: true,
              data: createResult.rows[0]
            });
            break;
            
          case 'update':
            const updateResult = await transaction.query(
              `UPDATE works 
               SET name = $1, description = $2, unit = $3, base_price = $4,
                   category = $5, phase_id = $6, is_active = $7, updated_at = NOW()
               WHERE id = $8 AND tenant_id = $9
               RETURNING *`,
              [
                data.name,
                data.description,
                data.unit,
                data.basePrice,
                data.category,
                data.phaseId,
                data.isActive,
                id,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'update',
              success: updateResult.rowCount > 0,
              data: updateResult.rows[0] || null
            });
            break;
            
          case 'delete':
            const deleteResult = await transaction.query(
              'DELETE FROM works WHERE id = $1 AND tenant_id = $2',
              [id, req.user.tenantId]
            );
            results.push({
              operation: 'delete',
              success: deleteResult.rowCount > 0,
              data: { id, deleted: deleteResult.rowCount > 0 }
            });
            break;
            
          default:
            results.push({
              operation: type,
              success: false,
              error: 'Unknown operation type'
            });
            break;
        }
      }
      
      await transaction.commit();
      
      res.json({
        success: true,
        processed: operations.length,
        results
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Batch works error:', error);
    res.status(500).json({
      error: 'Batch works operation failed',
      code: 'BATCH_WORKS_ERROR',
      details: error.message
    });
  }
});

/**
 * Batch Projects Requests
 * POST /api/batch/projects
 */
router.post('/projects', authMiddleware, async (req, res) => {
  try {
    const { operations } = req.body;
    const results = [];
    const transaction = await dbManager.transaction();
    
    try {
      for (const operation of operations) {
        const { type, data, id } = operation;
        
        switch (type) {
          case 'create':
            const createResult = await transaction.query(
              `INSERT INTO projects (name, description, status, user_id, tenant_id, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               RETURNING *`,
              [
                data.name,
                data.description,
                data.status || 'ACTIVE',
                req.user.id,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'create',
              success: true,
              data: createResult.rows[0]
            });
            break;
            
          case 'update':
            const updateResult = await transaction.query(
              `UPDATE projects 
               SET name = $1, description = $2, status = $3, updated_at = NOW()
               WHERE id = $4 AND user_id = $5 AND tenant_id = $6
               RETURNING *`,
              [
                data.name,
                data.description,
                data.status,
                id,
                req.user.id,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'update',
              success: updateResult.rowCount > 0,
              data: updateResult.rows[0] || null
            });
            break;
            
          case 'delete':
            const deleteResult = await transaction.query(
              'DELETE FROM projects WHERE id = $1 AND user_id = $2 AND tenant_id = $3',
              [id, req.user.id, req.user.tenantId]
            );
            results.push({
              operation: 'delete',
              success: deleteResult.rowCount > 0,
              data: { id, deleted: deleteResult.rowCount > 0 }
            });
            break;
            
          default:
            results.push({
              operation: type,
              success: false,
              error: 'Unknown operation type'
            });
            break;
        }
      }
      
      await transaction.commit();
      
      res.json({
        success: true,
        processed: operations.length,
        results
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Batch projects error:', error);
    res.status(500).json({
      error: 'Batch projects operation failed',
      code: 'BATCH_PROJECTS_ERROR',
      details: error.message
    });
  }
});

/**
 * Batch Estimates Requests
 * POST /api/batch/estimates
 */
router.post('/estimates', authMiddleware, async (req, res) => {
  try {
    const { operations } = req.body;
    const results = [];
    const transaction = await dbManager.transaction();
    
    try {
      for (const operation of operations) {
        const { type, data, id } = operation;
        
        switch (type) {
          case 'create':
            const createResult = await transaction.query(
              `INSERT INTO customer_estimates (project_id, name, description, status, currency, tenant_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               RETURNING *`,
              [
                data.projectId,
                data.name,
                data.description,
                data.status || 'DRAFT',
                data.currency || 'RUB',
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'create',
              success: true,
              data: createResult.rows[0]
            });
            break;
            
          case 'update':
            const updateResult = await transaction.query(
              `UPDATE customer_estimates 
               SET name = $1, description = $2, status = $3, currency = $4, updated_at = NOW()
               WHERE id = $5 AND tenant_id = $6
               RETURNING *`,
              [
                data.name,
                data.description,
                data.status,
                data.currency,
                id,
                req.user.tenantId
              ]
            );
            results.push({
              operation: 'update',
              success: updateResult.rowCount > 0,
              data: updateResult.rows[0] || null
            });
            break;
            
          case 'delete':
            const deleteResult = await transaction.query(
              'DELETE FROM customer_estimates WHERE id = $1 AND tenant_id = $2',
              [id, req.user.tenantId]
            );
            results.push({
              operation: 'delete',
              success: deleteResult.rowCount > 0,
              data: { id, deleted: deleteResult.rowCount > 0 }
            });
            break;
            
          default:
            results.push({
              operation: type,
              success: false,
              error: 'Unknown operation type'
            });
            break;
        }
      }
      
      await transaction.commit();
      
      res.json({
        success: true,
        processed: operations.length,
        results
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Batch estimates error:', error);
    res.status(500).json({
      error: 'Batch estimates operation failed',
      code: 'BATCH_ESTIMATES_ERROR',
      details: error.message
    });
  }
});

/**
 * Bulk Data Import
 * POST /api/batch/import
 */
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const { type, data, options = {} } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        error: 'Data must be a non-empty array',
        code: 'INVALID_IMPORT_DATA'
      });
    }
    
    const { batchSize = 100, skipErrors = false } = options;
    const results = {
      total: data.length,
      processed: 0,
      errors: 0,
      items: []
    };
    
    // Process in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const transaction = await dbManager.transaction();
      
      try {
        for (const item of batch) {
          try {
            let result;
            
            switch (type) {
              case 'materials':
                result = await transaction.query(
                  `INSERT INTO materials (name, description, type, unit, price, category, tenant_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id, name`,
                  [
                    item.name,
                    item.description,
                    item.type || 'BASIC',
                    item.unit,
                    item.price,
                    item.category,
                    req.user.tenantId
                  ]
                );
                break;
                
              case 'works':
                result = await transaction.query(
                  `INSERT INTO works (name, description, unit, base_price, category, tenant_id)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING id, name`,
                  [
                    item.name,
                    item.description,
                    item.unit,
                    item.basePrice,
                    item.category,
                    req.user.tenantId
                  ]
                );
                break;
                
              default:
                throw new Error(`Unsupported import type: ${type}`);
            }
            
            results.processed++;
            results.items.push({
              success: true,
              data: result.rows[0],
              original: item
            });
            
          } catch (error) {
            results.errors++;
            results.items.push({
              success: false,
              error: error.message,
              original: item
            });
            
            if (!skipErrors) {
              throw error;
            }
          }
        }
        
        await transaction.commit();
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${batch.length} items`);
        
      } catch (error) {
        await transaction.rollback();
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        
        if (!skipErrors) {
          throw error;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Import completed: ${results.processed} successful, ${results.errors} errors`,
      results
    });
    
  } catch (error) {
    console.error('❌ Bulk import error:', error);
    res.status(500).json({
      error: 'Bulk import failed',
      code: 'BULK_IMPORT_ERROR',
      details: error.message
    });
  }
});

/**
 * Batch Status Check
 * GET /api/batch/status/:batchId
 */
router.get('/status/:batchId', authMiddleware, async (req, res) => {
  try {
    const { batchId } = req.params;
    
    // In a real implementation, you would store batch status in database/Redis
    // For now, we'll return a mock response
    res.json({
      batchId,
      status: 'completed',
      progress: 100,
      startTime: new Date(Date.now() - 60000).toISOString(),
      endTime: new Date().toISOString(),
      totalItems: 10,
      processedItems: 10,
      errorItems: 0
    });
    
  } catch (error) {
    console.error('❌ Batch status error:', error);
    res.status(500).json({
      error: 'Failed to get batch status',
      code: 'BATCH_STATUS_ERROR'
    });
  }
});

export default router;