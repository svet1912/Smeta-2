/**
 * SMETA360-2 Security Middleware
 * Phase 4 Step 3: Security Hardening - OWASP Compliance
 * 
 * Comprehensive security middleware implementing OWASP security standards
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const validator = require('validator');
const xss = require('xss');
const hpp = require('hpp');
const cors = require('cors');
const winston = require('winston');
const crypto = require('crypto');

// Security audit logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'security-audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Security Configuration
 */
const SECURITY_CONFIG = {
  // Rate limiting configuration
  rateLimits: {
    // General API rate limit
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false
    },
    // Authentication endpoints
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
      message: {
        error: 'Too many login attempts, please try again later',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
      },
      skipSuccessfulRequests: true
    },
    // Password reset
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // limit each IP to 3 password reset attempts per hour
      message: {
        error: 'Too many password reset attempts, please try again later',
        code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
      }
    },
    // Registration
    registration: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // limit each IP to 5 registration attempts per hour
      message: {
        error: 'Too many registration attempts, please try again later',
        code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
      }
    }
  },
  
  // Speed limiting (progressive delay)
  speedLimits: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 100, // allow 100 requests per windowMs without delay
      delayMs: 500, // add 500ms delay per request after delayAfter
      maxDelayMs: 20000 // maximum delay of 20 seconds
    }
  },
  
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false
  },
  
  // CORS configuration
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://smeta360.com',
        'https://www.smeta360.com',
        'https://app.smeta360.com'
      ];
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        securityLogger.warn('CORS violation attempt', { 
          origin, 
          userAgent: 'unknown',
          timestamp: new Date().toISOString()
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Tenant-ID',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset'
    ],
    maxAge: 86400 // 24 hours
  },
  
  // Trusted proxies for rate limiting
  trustedProxies: ['127.0.0.1', '::1'],
  
  // Security headers
  securityHeaders: {
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      speaker: ['self'],
      vibrate: [],
      fullscreen: ['self'],
      'sync-xhr': []
    }
  }
};

/**
 * Request ID Generator
 */
const generateRequestId = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Security Audit Middleware
 */
const securityAudit = (req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  
  // Log security-relevant requests
  const securityPaths = ['/api/auth/', '/api/admin/', '/api/users/', '/api/tenants/'];
  const isSecurityRelevant = securityPaths.some(path => req.path.startsWith(path));
  
  if (isSecurityRelevant) {
    securityLogger.info('Security relevant request', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
      tenantId: req.user?.tenant_id
    });
  }
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Input Validation Middleware
 */
const inputValidation = {
  // Sanitize all string inputs
  sanitizeStrings: (req, res, next) => {
    const sanitizeObject = (obj) => {
      if (typeof obj === 'string') {
        return xss(validator.escape(obj.trim()));
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };
    
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    next();
  },
  
  // Validate email format
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') {
      return false;
    }
    return validator.isEmail(email) && email.length <= 254;
  },
  
  // Validate password strength
  validatePassword: (password) => {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: 'Password is required' };
    }
    
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    
    if (password.length > 128) {
      return { valid: false, message: 'Password is too long' };
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    
    if (!/(?=.*\d)/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
    }
    
    return { valid: true };
  },
  
  // Validate UUID format
  validateUUID: (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }
    return validator.isUUID(uuid, 4);
  },
  
  // Validate tenant ID in requests
  validateTenantAccess: async (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'] || req.body.tenant_id || req.query.tenant_id;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant ID is required',
        code: 'TENANT_ID_MISSING'
      });
    }
    
    if (!inputValidation.validateUUID(tenantId)) {
      return res.status(400).json({
        error: 'Invalid tenant ID format',
        code: 'INVALID_TENANT_ID'
      });
    }
    
    // Check if user has access to this tenant
    if (req.user && req.user.tenant_id !== tenantId) {
      securityLogger.warn('Tenant access violation attempt', {
        requestId: req.requestId,
        userId: req.user.id,
        userTenantId: req.user.tenant_id,
        requestedTenantId: tenantId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        error: 'Access denied to this tenant',
        code: 'TENANT_ACCESS_DENIED'
      });
    }
    
    req.tenantId = tenantId;
    next();
  }
};

/**
 * Request Size Limiting
 */
const requestSizeLimiting = {
  // General request size limit
  general: '10mb',
  // File upload limit
  fileUpload: '50mb',
  // JSON payload limit
  json: '5mb',
  // URL encoded payload limit
  urlencoded: '5mb'
};

/**
 * Security Headers Middleware
 */
const securityHeaders = (req, res, next) => {
  // Custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Remove potentially revealing headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add cache control for sensitive endpoints
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/admin/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

/**
 * IP Whitelist/Blacklist Middleware
 */
const ipFiltering = {
  // Admin IP whitelist (if configured)
  adminWhitelist: process.env.ADMIN_IP_WHITELIST ? 
    process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim()) : [],
  
  // IP blacklist
  blacklist: new Set(),
  
  // Add IP to blacklist
  blacklistIP: (ip, reason = 'security_violation') => {
    ipFiltering.blacklist.add(ip);
    securityLogger.warn('IP blacklisted', { ip, reason, timestamp: new Date().toISOString() });
  },
  
  // Check if IP is blacklisted
  isBlacklisted: (ip) => {
    return ipFiltering.blacklist.has(ip);
  },
  
  // Middleware function
  middleware: (req, res, next) => {
    const clientIP = req.ip;
    
    // Check blacklist
    if (ipFiltering.isBlacklisted(clientIP)) {
      securityLogger.warn('Blacklisted IP access attempt', {
        ip: clientIP,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        error: 'Access denied',
        code: 'IP_BLACKLISTED'
      });
    }
    
    // Check admin whitelist for admin endpoints
    if (req.path.startsWith('/api/admin/') && ipFiltering.adminWhitelist.length > 0) {
      if (!ipFiltering.adminWhitelist.includes(clientIP)) {
        securityLogger.warn('Admin access from non-whitelisted IP', {
          ip: clientIP,
          path: req.path,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        return res.status(403).json({
          error: 'Admin access restricted to whitelisted IPs',
          code: 'ADMIN_IP_NOT_WHITELISTED'
        });
      }
    }
    
    next();
  }
};

/**
 * Attack Detection Middleware
 */
const attackDetection = {
  // SQL injection patterns
  sqlInjectionPatterns: [
    /(\s*(union|select|insert|delete|update|drop|create|alter|exec|execute)\s+)/i,
    /(\s*(or|and)\s+\d+\s*=\s*\d+)/i,
    /(\s*(or|and)\s+['"]\w+['\"]\s*=\s*['"]\w+['"])/i,
    /(benchmark|sleep|waitfor|delay)\s*\(/i,
    /(information_schema|mysql\.user|sys\.databases)/i
  ],
  
  // XSS patterns
  xssPatterns: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi
  ],
  
  // Path traversal patterns
  pathTraversalPatterns: [
    /\.\.[\/\\]/g,
    /[\/\\]\.\.[\/\\]/g,
    /%2e%2e[\/\\]/gi,
    /\.\.[%2f%5c]/gi
  ],
  
  // Command injection patterns
  commandInjectionPatterns: [
    /[;&|`$]/g,
    /(nc|netcat|wget|curl|bash|sh|cmd|powershell)\s+/gi,
    /\$\(.*\)/g,
    /`.*`/g
  ],
  
  // Check for attack patterns
  detectAttack: (input) => {
    if (typeof input !== 'string') return null;
    
    const checks = [
      { patterns: attackDetection.sqlInjectionPatterns, type: 'SQL_INJECTION' },
      { patterns: attackDetection.xssPatterns, type: 'XSS' },
      { patterns: attackDetection.pathTraversalPatterns, type: 'PATH_TRAVERSAL' },
      { patterns: attackDetection.commandInjectionPatterns, type: 'COMMAND_INJECTION' }
    ];
    
    for (const check of checks) {
      for (const pattern of check.patterns) {
        if (pattern.test(input)) {
          return check.type;
        }
      }
    }
    
    return null;
  },
  
  // Middleware function
  middleware: (req, res, next) => {
    const checkPayload = (obj, path = '') => {
      if (typeof obj === 'string') {
        const attackType = attackDetection.detectAttack(obj);
        if (attackType) {
          return { detected: true, type: attackType, path, value: obj };
        }
      } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const result = checkPayload(obj[i], `${path}[${i}]`);
          if (result.detected) return result;
        }
      } else if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          const result = checkPayload(value, path ? `${path}.${key}` : key);
          if (result.detected) return result;
        }
      }
      
      return { detected: false };
    };
    
    // Check request body
    if (req.body) {
      const bodyResult = checkPayload(req.body, 'body');
      if (bodyResult.detected) {
        securityLogger.error('Attack pattern detected in request body', {
          requestId: req.requestId,
          attackType: bodyResult.type,
          path: bodyResult.path,
          value: bodyResult.value,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method
        });
        
        // Add IP to blacklist for repeated attacks
        ipFiltering.blacklistIP(req.ip, `attack_${bodyResult.type.toLowerCase()}`);
        
        return res.status(400).json({
          error: 'Invalid request data',
          code: 'ATTACK_PATTERN_DETECTED'
        });
      }
    }
    
    // Check query parameters
    if (req.query) {
      const queryResult = checkPayload(req.query, 'query');
      if (queryResult.detected) {
        securityLogger.error('Attack pattern detected in query parameters', {
          requestId: req.requestId,
          attackType: queryResult.type,
          path: queryResult.path,
          value: queryResult.value,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.url,
          method: req.method
        });
        
        ipFiltering.blacklistIP(req.ip, `attack_${queryResult.type.toLowerCase()}`);
        
        return res.status(400).json({
          error: 'Invalid query parameters',
          code: 'ATTACK_PATTERN_DETECTED'
        });
      }
    }
    
    next();
  }
};

/**
 * Create Rate Limiter
 */
const createRateLimiter = (config) => {
  return rateLimit({
    ...config,
    keyGenerator: (req) => {
      // Use combination of IP and user ID for authenticated requests
      if (req.user && req.user.id) {
        return `${req.ip}:${req.user.id}`;
      }
      return req.ip;
    },
    onLimitReached: (req, res, options) => {
      securityLogger.warn('Rate limit exceeded', {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        userId: req.user?.id,
        limit: options.max,
        windowMs: options.windowMs
      });
    }
  });
};

/**
 * Export Security Middleware
 */
module.exports = {
  // Configuration
  SECURITY_CONFIG,
  requestSizeLimiting,
  
  // Core middleware
  helmet: helmet({
    contentSecurityPolicy: SECURITY_CONFIG.csp,
    hsts: SECURITY_CONFIG.securityHeaders.hsts,
    noSniff: SECURITY_CONFIG.securityHeaders.noSniff,
    xssFilter: SECURITY_CONFIG.securityHeaders.xssFilter,
    referrerPolicy: SECURITY_CONFIG.securityHeaders.referrerPolicy,
    permissionsPolicy: SECURITY_CONFIG.securityHeaders.permissionsPolicy
  }),
  
  cors: cors(SECURITY_CONFIG.cors),
  hpp: hpp(),
  
  // Custom middleware
  securityAudit,
  securityHeaders,
  ipFiltering,
  attackDetection,
  inputValidation,
  
  // Rate limiters
  rateLimiters: {
    general: createRateLimiter(SECURITY_CONFIG.rateLimits.general),
    auth: createRateLimiter(SECURITY_CONFIG.rateLimits.auth),
    passwordReset: createRateLimiter(SECURITY_CONFIG.rateLimits.passwordReset),
    registration: createRateLimiter(SECURITY_CONFIG.rateLimits.registration)
  },
  
  // Speed limiter
  speedLimiter: slowDown(SECURITY_CONFIG.speedLimits.general),
  
  // Utilities
  generateRequestId,
  securityLogger
};