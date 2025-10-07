/**
 * API Versioning System
 * Phase 3 Step 2: API Performance Optimization
 * 
 * Поддержка версионирования API с обратной совместимостью
 */

import express from 'express';

// Version handlers
const versionHandlers = new Map();

/**
 * API Version Manager
 */
class APIVersionManager {
  constructor() {
    this.supportedVersions = ['v1', 'v2'];
    this.defaultVersion = 'v1';
    this.deprecatedVersions = [];
    this.versionMappings = new Map();
    
    console.log('🔢 API Version Manager инициализирован');
  }

  /**
   * Register version handler
   */
  registerVersion(version, handler) {
    if (!this.supportedVersions.includes(version)) {
      throw new Error(`Unsupported API version: ${version}`);
    }
    
    versionHandlers.set(version, handler);
    console.log(`📝 Registered API version ${version}`);
  }

  /**
   * Get version from request
   */
  extractVersion(req) {
    // Check URL path first (/api/v2/materials)
    const urlVersion = this.extractVersionFromUrl(req.originalUrl);
    if (urlVersion) return urlVersion;
    
    // Check Accept header (Accept: application/vnd.api+json;version=2)
    const acceptVersion = this.extractVersionFromAcceptHeader(req.headers.accept);
    if (acceptVersion) return acceptVersion;
    
    // Check custom header
    const headerVersion = req.headers['api-version'];
    if (headerVersion) return `v${headerVersion}`;
    
    // Check query parameter
    const queryVersion = req.query.version;
    if (queryVersion) return `v${queryVersion}`;
    
    return this.defaultVersion;
  }

  /**
   * Extract version from URL
   */
  extractVersionFromUrl(url) {
    const match = url.match(/\/api\/v(\d+)\//);
    return match ? `v${match[1]}` : null;
  }

  /**
   * Extract version from Accept header
   */
  extractVersionFromAcceptHeader(acceptHeader) {
    if (!acceptHeader) return null;
    
    const match = acceptHeader.match(/version=(\d+)/);
    return match ? `v${match[1]}` : null;
  }

  /**
   * Version compatibility middleware
   */
  versioningMiddleware() {
    return (req, res, next) => {
      const version = this.extractVersion(req);
      
      // Set version info
      req.apiVersion = version;
      res.setHeader('API-Version', version);
      
      // Check if version is supported
      if (!this.supportedVersions.includes(version)) {
        return res.status(400).json({
          error: 'Unsupported API version',
          code: 'UNSUPPORTED_VERSION',
          supportedVersions: this.supportedVersions,
          requestedVersion: version
        });
      }
      
      // Add deprecation warning
      if (this.deprecatedVersions.includes(version)) {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', this.getSunsetDate(version));
        res.setHeader('Link', `</api/${this.getRecommendedVersion()}/docs>; rel="successor-version"`);
      }
      
      // Set version-specific flags
      req.isV1 = version === 'v1';
      req.isV2 = version === 'v2';
      
      next();
    };
  }

  /**
   * Get sunset date for deprecated version
   */
  getSunsetDate(version) {
    const sunsetDates = {
      'v1': '2026-01-01'
    };
    return sunsetDates[version] || null;
  }

  /**
   * Get recommended version
   */
  getRecommendedVersion() {
    return this.supportedVersions[this.supportedVersions.length - 1];
  }

  /**
   * Deprecate version
   */
  deprecateVersion(version, sunsetDate) {
    if (!this.deprecatedVersions.includes(version)) {
      this.deprecatedVersions.push(version);
      console.log(`⚠️  API version ${version} deprecated. Sunset: ${sunsetDate}`);
    }
  }

  /**
   * Transform response based on version
   */
  transformResponse(data, version, endpoint) {
    const transformer = this.getResponseTransformer(version, endpoint);
    return transformer ? transformer(data) : data;
  }

  /**
   * Get response transformer for version
   */
  getResponseTransformer(version, endpoint) {
    return this.versionMappings.get(`${version}:${endpoint}`);
  }

  /**
   * Register response transformer
   */
  registerResponseTransformer(version, endpoint, transformer) {
    this.versionMappings.set(`${version}:${endpoint}`, transformer);
  }
}

// Singleton instance
const versionManager = new APIVersionManager();

/**
 * V1 Response Transformers
 */
const v1Transformers = {
  // Materials transformer (legacy format)
  materials: (data) => {
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        unit: item.unit,
        price: item.price,
        category: item.category,
        active: item.is_active, // v1 uses 'active' instead of 'is_active'
        created: item.created_at, // v1 uses 'created' instead of 'created_at'
        updated: item.updated_at // v1 uses 'updated' instead of 'updated_at'
      }));
    } else {
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        unit: data.unit,
        price: data.price,
        category: data.category,
        active: data.is_active,
        created: data.created_at,
        updated: data.updated_at
      };
    }
  },

  // Works transformer
  works: (data) => {
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        unit: item.unit,
        price: item.base_price, // v1 uses 'price' instead of 'base_price'
        category: item.category,
        active: item.is_active,
        created: item.created_at,
        updated: item.updated_at
      }));
    } else {
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        unit: data.unit,
        price: data.base_price,
        category: data.category,
        active: data.is_active,
        created: data.created_at,
        updated: data.updated_at
      };
    }
  },

  // Projects transformer
  projects: (data) => {
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        status: item.status.toLowerCase(), // v1 uses lowercase status
        owner: item.user_id, // v1 uses 'owner' instead of 'user_id'
        created: item.created_at,
        updated: item.updated_at
      }));
    } else {
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status.toLowerCase(),
        owner: data.user_id,
        created: data.created_at,
        updated: data.updated_at
      };
    }
  }
};

/**
 * V2 Response Transformers (modern format)
 */
const v2Transformers = {
  // Materials transformer (modern format with enhanced fields)
  materials: (data) => {
    if (Array.isArray(data)) {
      return {
        data: data.map(item => ({
          id: item.id,
          attributes: {
            name: item.name,
            description: item.description,
            type: item.type,
            unit: item.unit,
            pricing: {
              current: item.price,
              currency: 'RUB'
            },
            category: item.category,
            status: item.is_active ? 'active' : 'inactive',
            metadata: {
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              version: '2.0'
            }
          }
        })),
        meta: {
          count: data.length,
          version: 'v2'
        }
      };
    } else {
      return {
        data: {
          id: data.id,
          attributes: {
            name: data.name,
            description: data.description,
            type: data.type,
            unit: data.unit,
            pricing: {
              current: data.price,
              currency: 'RUB'
            },
            category: data.category,
            status: data.is_active ? 'active' : 'inactive',
            metadata: {
              createdAt: data.created_at,
              updatedAt: data.updated_at,
              version: '2.0'
            }
          }
        }
      };
    }
  },

  // Works transformer (modern format)
  works: (data) => {
    if (Array.isArray(data)) {
      return {
        data: data.map(item => ({
          id: item.id,
          type: 'work',
          attributes: {
            name: item.name,
            description: item.description,
            specifications: {
              unit: item.unit,
              basePrice: item.base_price,
              currency: 'RUB'
            },
            classification: {
              category: item.category,
              phaseId: item.phase_id
            },
            status: item.is_active ? 'active' : 'inactive',
            metadata: {
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              version: '2.0'
            }
          }
        })),
        meta: {
          count: data.length,
          version: 'v2'
        }
      };
    } else {
      return {
        data: {
          id: data.id,
          type: 'work',
          attributes: {
            name: data.name,
            description: data.description,
            specifications: {
              unit: data.unit,
              basePrice: data.base_price,
              currency: 'RUB'
            },
            classification: {
              category: data.category,
              phaseId: data.phase_id
            },
            status: data.is_active ? 'active' : 'inactive',
            metadata: {
              createdAt: data.created_at,
              updatedAt: data.updated_at,
              version: '2.0'
            }
          }
        }
      };
    }
  },

  // Projects transformer (modern format)
  projects: (data) => {
    if (Array.isArray(data)) {
      return {
        data: data.map(item => ({
          id: item.id,
          type: 'project',
          attributes: {
            name: item.name,
            description: item.description,
            status: {
              current: item.status,
              displayName: this.getStatusDisplayName(item.status)
            },
            ownership: {
              userId: item.user_id,
              tenantId: item.tenant_id
            },
            timeline: {
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              lastActivity: item.updated_at
            },
            metadata: {
              version: '2.0'
            }
          }
        })),
        meta: {
          count: data.length,
          version: 'v2'
        }
      };
    } else {
      return {
        data: {
          id: data.id,
          type: 'project',
          attributes: {
            name: data.name,
            description: data.description,
            status: {
              current: data.status,
              displayName: this.getStatusDisplayName(data.status)
            },
            ownership: {
              userId: data.user_id,
              tenantId: data.tenant_id
            },
            timeline: {
              createdAt: data.created_at,
              updatedAt: data.updated_at,
              lastActivity: data.updated_at
            },
            metadata: {
              version: '2.0'
            }
          }
        }
      };
    }
  },

  getStatusDisplayName(status) {
    const statusMap = {
      'ACTIVE': 'Активный',
      'COMPLETED': 'Завершен',
      'PAUSED': 'Приостановлен',
      'CANCELLED': 'Отменен'
    };
    return statusMap[status] || status;
  }
};

// Register transformers
Object.keys(v1Transformers).forEach(endpoint => {
  versionManager.registerResponseTransformer('v1', endpoint, v1Transformers[endpoint]);
});

Object.keys(v2Transformers).forEach(endpoint => {
  versionManager.registerResponseTransformer('v2', endpoint, v2Transformers[endpoint]);
});

/**
 * Response transformation middleware
 */
export function responseTransformMiddleware() {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Determine endpoint from route
      const endpoint = this.getEndpointName(req);
      
      // Transform response if transformer exists
      const transformedData = versionManager.transformResponse(data, req.apiVersion, endpoint);
      
      // Add version info to headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('API-Version', req.apiVersion);
      
      // Add CORS headers for API versioning
      res.setHeader('Access-Control-Expose-Headers', 'API-Version, Deprecation, Sunset, Link');
      
      return originalJson.call(this, transformedData);
    }.bind({ getEndpointName: this.getEndpointName });
    
    next();
  };
}

/**
 * Get endpoint name from request
 */
function getEndpointName(req) {
  const path = req.route?.path || req.path;
  
  if (path.includes('materials')) return 'materials';
  if (path.includes('works')) return 'works';
  if (path.includes('projects')) return 'projects';
  if (path.includes('estimates')) return 'estimates';
  
  return 'generic';
}

/**
 * API Documentation endpoint
 * GET /api/docs
 */
export function createDocsRouter() {
  const router = express.Router();
  
  router.get('/docs', (req, res) => {
    const version = versionManager.extractVersion(req);
    
    const docs = {
      version,
      title: `SMETA360 API ${version.toUpperCase()}`,
      description: 'Construction Estimation System API',
      supportedVersions: versionManager.supportedVersions,
      deprecatedVersions: versionManager.deprecatedVersions,
      endpoints: getEndpointDocumentation(version),
      changelog: getVersionChangelog(version),
      examples: getVersionExamples(version)
    };
    
    res.json(docs);
  });
  
  router.get('/version', (req, res) => {
    res.json({
      current: versionManager.extractVersion(req),
      supported: versionManager.supportedVersions,
      deprecated: versionManager.deprecatedVersions,
      default: versionManager.defaultVersion,
      recommended: versionManager.getRecommendedVersion()
    });
  });
  
  return router;
}

/**
 * Get endpoint documentation for version
 */
function getEndpointDocumentation(version) {
  const baseEndpoints = {
    'GET /materials': 'Get list of materials',
    'GET /materials/:id': 'Get material by ID',
    'POST /materials': 'Create new material',
    'PUT /materials/:id': 'Update material',
    'DELETE /materials/:id': 'Delete material',
    'GET /works': 'Get list of works',
    'GET /works/:id': 'Get work by ID',
    'POST /works': 'Create new work',
    'PUT /works/:id': 'Update work',
    'DELETE /works/:id': 'Delete work',
    'GET /projects': 'Get user projects',
    'GET /projects/:id': 'Get project by ID',
    'POST /projects': 'Create new project',
    'PUT /projects/:id': 'Update project',
    'DELETE /projects/:id': 'Delete project'
  };
  
  if (version === 'v2') {
    return {
      ...baseEndpoints,
      'POST /batch': 'Batch API operations',
      'GET /graphql': 'GraphQL endpoint',
      'POST /graphql': 'GraphQL queries and mutations'
    };
  }
  
  return baseEndpoints;
}

/**
 * Get version changelog
 */
function getVersionChangelog(version) {
  const changelogs = {
    'v1': [
      'Initial API release',
      'Basic CRUD operations',
      'Authentication support',
      'Tenant isolation'
    ],
    'v2': [
      'GraphQL support',
      'Batch API operations',
      'Enhanced response format',
      'Performance optimizations',
      'Advanced filtering and pagination',
      'Response compression',
      'API caching'
    ]
  };
  
  return changelogs[version] || [];
}

/**
 * Get version examples
 */
function getVersionExamples(version) {
  if (version === 'v1') {
    return {
      material: {
        id: '123',
        name: 'Кирпич керамический',
        unit: 'шт',
        price: 15.50,
        active: true,
        created: '2025-01-01T00:00:00.000Z'
      }
    };
  } else {
    return {
      material: {
        data: {
          id: '123',
          attributes: {
            name: 'Кирпич керамический',
            unit: 'шт',
            pricing: {
              current: 15.50,
              currency: 'RUB'
            },
            status: 'active',
            metadata: {
              createdAt: '2025-01-01T00:00:00.000Z',
              version: '2.0'
            }
          }
        }
      }
    };
  }
}

// Deprecate v1 (example)
// versionManager.deprecateVersion('v1', '2026-01-01');

export {
  versionManager,
  responseTransformMiddleware,
  createDocsRouter
};

export default versionManager;