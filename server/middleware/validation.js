/**
 * SMETA360-2 Input Validation & Sanitization
 * Phase 4 Step 3: Security Hardening - Input Validation
 *
 * Comprehensive input validation and sanitization middleware
 */

const validator = require('validator');
const xss = require('xss');
const Joi = require('joi');

/**
 * Input Validation Schema Definitions
 */
const schemas = {
  // Authentication schemas
  login: Joi.object({
    email: Joi.string().email().required().max(254),
    password: Joi.string().min(8).max(128).required(),
    remember: Joi.boolean().optional()
  }),

  register: Joi.object({
    email: Joi.string().email().required().max(254),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required(),
    firstName: Joi.string().min(1).max(50).pattern(/^[a-zA-Zа-яА-Я\s-']+$/).required(),
    lastName: Joi.string().min(1).max(50).pattern(/^[a-zA-Zа-яА-Я\s-']+$/).required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).max(20).optional(),
    tenantId: Joi.string().uuid().optional()
  }),

  // Project schemas
  project: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(1000).optional(),
    address: Joi.string().max(300).optional(),
    client: Joi.string().max(200).optional(),
    totalArea: Joi.number().positive().max(1000000).optional(),
    floors: Joi.number().integer().min(1).max(200).optional(),
    status: Joi.string().valid('draft', 'active', 'completed', 'archived').default('draft'),
    budget: Joi.number().positive().max(10000000000).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().greater(Joi.ref('startDate')).optional()
  }),

  // Estimate schemas
  estimate: Joi.object({
    projectId: Joi.string().uuid().required(),
    name: Joi.string().min(1).max(200).required(),
    type: Joi.string().valid('preliminary', 'detailed', 'final').required(),
    items: Joi.array().items(Joi.object({
      workId: Joi.string().uuid().required(),
      quantity: Joi.number().positive().max(1000000).required(),
      unitPrice: Joi.number().positive().max(1000000).required(),
      description: Joi.string().max(500).optional()
    })).max(10000).required()
  }),

  // Work item schemas
  workItem: Joi.object({
    code: Joi.string().pattern(/^[A-Z0-9\-_.]+$/).max(50).required(),
    name: Joi.string().min(1).max(300).required(),
    unit: Joi.string().min(1).max(20).required(),
    basePrice: Joi.number().positive().max(1000000).required(),
    category: Joi.string().max(100).optional(),
    description: Joi.string().max(1000).optional(),
    materials: Joi.array().items(Joi.object({
      materialId: Joi.string().uuid().required(),
      quantity: Joi.number().positive().required()
    })).max(100).optional()
  }),

  // Material schemas
  material: Joi.object({
    name: Joi.string().min(1).max(200).required(),
    unit: Joi.string().min(1).max(20).required(),
    price: Joi.number().positive().max(1000000).required(),
    supplier: Joi.string().max(200).optional(),
    category: Joi.string().max(100).optional(),
    specifications: Joi.string().max(1000).optional()
  }),

  // User profile schemas
  userProfile: Joi.object({
    firstName: Joi.string().min(1).max(50).pattern(/^[a-zA-Zа-яА-Я\s-']+$/).optional(),
    lastName: Joi.string().min(1).max(50).pattern(/^[a-zA-Zа-яА-Я\s-']+$/).optional(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).max(20).optional(),
    avatar: Joi.string().uri().max(500).optional(),
    timezone: Joi.string().max(50).optional(),
    language: Joi.string().valid('ru', 'en', 'uk').optional()
  }),

  // Search and pagination schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).max(10000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50).optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  search: Joi.object({
    query: Joi.string().min(1).max(100).optional(),
    filters: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
      Joi.string().max(100),
      Joi.number(),
      Joi.boolean(),
      Joi.array().items(Joi.string().max(100)).max(10)
    )).optional()
  }),

  // File upload schemas
  fileUpload: Joi.object({
    originalName: Joi.string().min(1).max(255).required(),
    mimetype: Joi.string().valid(
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'text/plain'
    ).required(),
    size: Joi.number().max(10 * 1024 * 1024).required() // 10MB max
  })
};

/**
 * Input Sanitization Functions
 */
const sanitizers = {
  /**
   * Sanitize string input
   */
  string: (value, options = {}) => {
    if (typeof value !== 'string') return value;

    let sanitized = value;

    // Trim whitespace
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // XSS protection
    if (options.xss !== false) {
      sanitized = xss(sanitized, {
        whiteList: options.allowedTags || {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style']
      });
    }

    // HTML entity encode if requested
    if (options.htmlEncode) {
      sanitized = validator.escape(sanitized);
    }

    // Remove control characters except tabs and newlines
    if (options.removeControlChars !== false) {
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    return sanitized;
  },

  /**
   * Sanitize email input
   */
  email: (value) => {
    if (typeof value !== 'string') return value;
    
    let email = value.toLowerCase().trim();
    
    // Remove dangerous characters
    email = email.replace(/[<>'"&]/g, '');
    
    return validator.isEmail(email) ? email : null;
  },

  /**
   * Sanitize numeric input
   */
  number: (value, options = {}) => {
    const num = parseFloat(value);
    
    if (isNaN(num)) return null;
    if (options.min !== undefined && num < options.min) return null;
    if (options.max !== undefined && num > options.max) return null;
    
    return num;
  },

  /**
   * Sanitize boolean input
   */
  boolean: (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return null;
  },

  /**
   * Sanitize array input
   */
  array: (value, itemSanitizer) => {
    if (!Array.isArray(value)) return null;
    
    return value.map(item => itemSanitizer ? itemSanitizer(item) : item);
  },

  /**
   * Sanitize filename
   */
  filename: (value) => {
    if (typeof value !== 'string') return value;
    
    // Remove directory traversal attempts
    let filename = value.replace(/[/\\:*?"<>|]/g, '');
    
    // Remove dots from beginning and end
    filename = filename.replace(/^\.+|\.+$/g, '');
    
    // Limit length
    if (filename.length > 255) {
      filename = filename.substring(0, 255);
    }
    
    return filename || 'unnamed';
  },

  /**
   * Sanitize SQL-like input (basic protection)
   */
  sqlSafe: (value) => {
    if (typeof value !== 'string') return value;
    
    // Remove common SQL injection patterns
    const dangerous = [
      /(')|(;)|(\/\*)|(\*\/)|(--)|(\|\|)|(@@)|(\b(exec|execute|sp_|xp_)\b)/gi,
      /(\b(union|select|insert|update|delete|drop|create|alter|truncate)\b)/gi
    ];
    
    let sanitized = value;
    dangerous.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized;
  }
};

/**
 * Validation Middleware Factory
 */
const createValidationMiddleware = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return res.status(500).json({
        error: 'Internal server error',
        code: 'VALIDATION_SCHEMA_NOT_FOUND'
      });
    }
    
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      });
    }
    
    // Replace original data with validated and sanitized data
    req[source] = value;
    next();
  };
};

/**
 * Generic Sanitization Middleware
 */
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj, depth = 0) => {
    if (depth > 10) return obj; // Prevent deep recursion
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, depth + 1));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizers.string(key, { xss: true, htmlEncode: false });
        sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
      }
      return sanitized;
    }
    
    if (typeof obj === 'string') {
      return sanitizers.string(obj, { xss: true, htmlEncode: false });
    }
    
    return obj;
  };
  
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

/**
 * File Upload Validation Middleware
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }
  
  const files = req.files ? Object.values(req.files).flat() : [req.file];
  
  for (const file of files) {
    const { error } = schemas.fileUpload.validate({
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    if (error) {
      return res.status(400).json({
        error: 'File validation failed',
        code: 'FILE_VALIDATION_ERROR',
        details: error.details.map(detail => detail.message)
      });
    }
    
    // Sanitize filename
    file.originalname = sanitizers.filename(file.originalname);
  }
  
  next();
};

/**
 * Request Size Limiter
 */
const limitRequestSize = (maxSize = 1024 * 1024) => { // 1MB default
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxSize
      });
    }
    
    next();
  };
};

/**
 * SQL Injection Protection Middleware
 */
const sqlInjectionProtection = (req, res, next) => {
  const checkForSQLInjection = (obj, path = '') => {
    if (typeof obj === 'string') {
      const sqlPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter|truncate|exec|execute)\b)/gi,
        /(\/\*.*?\*\/|--[^\r\n]*)/gi,
        /([';].*?[';])/gi,
        /(\b(or|and)\b.*?[=<>])/gi
      ];
      
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          return `Potential SQL injection detected in ${path || 'request'}`;
        }
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = checkForSQLInjection(obj[i], `${path}[${i}]`);
        if (result) return result;
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const result = checkForSQLInjection(value, path ? `${path}.${key}` : key);
        if (result) return result;
      }
    }
    
    return null;
  };
  
  // Check body, query, and params
  const sources = ['body', 'query', 'params'];
  
  for (const source of sources) {
    if (req[source]) {
      const result = checkForSQLInjection(req[source], source);
      if (result) {
        console.warn(`SQL injection attempt detected: ${result}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method
        });
        
        return res.status(400).json({
          error: 'Invalid input detected',
          code: 'INVALID_INPUT'
        });
      }
    }
  }
  
  next();
};

/**
 * NoSQL Injection Protection Middleware
 */
const noSQLInjectionProtection = (req, res, next) => {
  const sanitizeNoSQL = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeNoSQL);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Remove MongoDB operators
        if (key.startsWith('$') || key.includes('.')) {
          continue;
        }
        sanitized[key] = sanitizeNoSQL(value);
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeNoSQL(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeNoSQL(req.query);
  }
  
  next();
};

module.exports = {
  schemas,
  sanitizers,
  createValidationMiddleware,
  sanitizeInput,
  validateFileUpload,
  limitRequestSize,
  sqlInjectionProtection,
  noSQLInjectionProtection
};