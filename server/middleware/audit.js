/**
 * SMETA360-2 Security Audit & Logging
 * Phase 4 Step 3: Security Hardening - Audit & Logging
 *
 * Comprehensive security audit and logging system
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Security Events Configuration
 */
const securityEvents = {
  // Authentication events
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  AUTH_LOCKOUT: 'AUTH_LOCKOUT',
  AUTH_UNLOCK: 'AUTH_UNLOCK',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  LOGOUT: 'LOGOUT',

  // Authorization events
  ACCESS_GRANTED: 'ACCESS_GRANTED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION',
  ROLE_CHANGE: 'ROLE_CHANGE',

  // Security violations
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  CSRF_VIOLATION: 'CSRF_VIOLATION',
  INPUT_VALIDATION_FAILED: 'INPUT_VALIDATION_FAILED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',

  // System events
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  SYSTEM_START: 'SYSTEM_START',
  SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',
  DATABASE_CONNECTION: 'DATABASE_CONNECTION',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // File operations
  FILE_UPLOAD: 'FILE_UPLOAD',
  FILE_DOWNLOAD: 'FILE_DOWNLOAD',
  FILE_DELETE: 'FILE_DELETE',
  UNAUTHORIZED_FILE_ACCESS: 'UNAUTHORIZED_FILE_ACCESS',

  // Network events
  IP_BLOCKED: 'IP_BLOCKED',
  IP_UNBLOCKED: 'IP_UNBLOCKED',
  GEOLOCATION_BLOCKED: 'GEOLOCATION_BLOCKED',
  USER_AGENT_BLOCKED: 'USER_AGENT_BLOCKED'
};

/**
 * Security Logger Configuration
 */
class SecurityLogger {
  constructor(options = {}) {
    this.options = {
      logDir: options.logDir || path.join(process.cwd(), 'logs'),
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      maxFiles: options.maxFiles || 30,
      format: options.format || 'json',
      level: options.level || 'info',
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      enableRemote: options.enableRemote || false,
      remoteEndpoint: options.remoteEndpoint,
      ...options
    };

    this.createLogDirectory();
    this.setupLoggers();
  }

  /**
   * Create log directory if it doesn't exist
   */
  createLogDirectory() {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }
  }

  /**
   * Setup Winston loggers
   */
  setupLoggers() {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const transports = [];

    // Console transport
    if (this.options.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      );
    }

    // File transports
    if (this.options.enableFile) {
      // Security audit log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.options.logDir, 'security-audit.log'),
          maxsize: this.options.maxFileSize,
          maxFiles: this.options.maxFiles,
          format: logFormat
        })
      );

      // Error log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.options.logDir, 'security-errors.log'),
          level: 'error',
          maxsize: this.options.maxFileSize,
          maxFiles: this.options.maxFiles,
          format: logFormat
        })
      );

      // Authentication log
      transports.push(
        new winston.transports.File({
          filename: path.join(this.options.logDir, 'auth.log'),
          maxsize: this.options.maxFileSize,
          maxFiles: this.options.maxFiles,
          format: logFormat
        })
      );
    }

    // Remote transport (if configured)
    if (this.options.enableRemote && this.options.remoteEndpoint) {
      const { Http } = require('winston-transport');
      transports.push(
        new Http({
          host: this.options.remoteEndpoint.host,
          port: this.options.remoteEndpoint.port,
          path: this.options.remoteEndpoint.path || '/logs',
          ssl: this.options.remoteEndpoint.ssl || false
        })
      );
    }

    this.logger = winston.createLogger({
      level: this.options.level,
      format: logFormat,
      transports: transports
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(eventType, details = {}, severity = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: eventType,
      severity: severity,
      sessionId: details.sessionId,
      userId: details.userId,
      tenantId: details.tenantId,
      ip: details.ip,
      userAgent: details.userAgent,
      resource: details.resource,
      action: details.action,
      result: details.result,
      details: details.additionalInfo || {},
      stackTrace: details.error?.stack
    };

    this.logger.log(severity, 'Security Event', logEntry);

    // Alert on critical events
    if (severity === 'error' || this.isCriticalEvent(eventType)) {
      this.handleCriticalEvent(logEntry);
    }

    return logEntry;
  }

  /**
   * Check if event is critical
   */
  isCriticalEvent(eventType) {
    const criticalEvents = [
      securityEvents.AUTH_LOCKOUT,
      securityEvents.SQL_INJECTION_ATTEMPT,
      securityEvents.XSS_ATTEMPT,
      securityEvents.PRIVILEGE_ESCALATION,
      securityEvents.UNAUTHORIZED_FILE_ACCESS,
      securityEvents.SYSTEM_SHUTDOWN
    ];

    return criticalEvents.includes(eventType);
  }

  /**
   * Handle critical security events
   */
  handleCriticalEvent(logEntry) {
    // Immediate console alert
    console.error('🚨 CRITICAL SECURITY EVENT:', logEntry);

    // Could implement additional alerting mechanisms:
    // - Email notifications
    // - Slack/Discord webhooks
    // - SMS alerts
    // - System monitoring integration

    // For now, just ensure it's logged at error level
    this.logger.error('Critical Security Event', logEntry);
  }

  /**
   * Log authentication events
   */
  logAuth(event, req, details = {}) {
    return this.logSecurityEvent(event, {
      ...this.extractRequestInfo(req),
      ...details
    }, event.includes('FAILURE') ? 'warn' : 'info');
  }

  /**
   * Log authorization events
   */
  logAuthorization(event, req, details = {}) {
    return this.logSecurityEvent(event, {
      ...this.extractRequestInfo(req),
      ...details
    }, event === securityEvents.ACCESS_DENIED ? 'warn' : 'info');
  }

  /**
   * Log security violations
   */
  logViolation(event, req, details = {}) {
    return this.logSecurityEvent(event, {
      ...this.extractRequestInfo(req),
      ...details
    }, 'error');
  }

  /**
   * Log system events
   */
  logSystem(event, details = {}) {
    return this.logSecurityEvent(event, details, 'info');
  }

  /**
   * Extract request information
   */
  extractRequestInfo(req) {
    if (!req) return {};

    return {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.url,
      referer: req.get('Referer'),
      sessionId: req.sessionID,
      userId: req.user?.id,
      tenantId: req.tenant?.id,
      resource: req.route?.path,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(startDate, endDate) {
    // This would typically read from log files or database
    // For now, return a basic structure
    return {
      period: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalEvents: 0,
        authEvents: 0,
        violations: 0,
        criticalEvents: 0
      },
      topEvents: [],
      topIPs: [],
      topUsers: [],
      trends: {}
    };
  }
}

/**
 * Security Audit Middleware
 */
const createSecurityAuditMiddleware = (securityLogger) => {
  return (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override res.end to log response
    res.end = function(chunk, encoding) {
      // Log the request/response
      securityLogger.logSecurityEvent(securityEvents.ACCESS_GRANTED, {
        ...securityLogger.extractRequestInfo(req),
        statusCode: res.statusCode,
        responseTime: Date.now() - req.startTime,
        contentLength: res.get('Content-Length')
      }, res.statusCode >= 400 ? 'warn' : 'info');

      // Call original end function
      originalEnd.call(this, chunk, encoding);
    };

    // Store request start time
    req.startTime = Date.now();

    next();
  };
};

/**
 * Error Audit Middleware
 */
const createErrorAuditMiddleware = (securityLogger) => {
  return (error, req, res, next) => {
    // Log the error
    securityLogger.logSecurityEvent('ERROR', {
      ...securityLogger.extractRequestInfo(req),
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    }, 'error');

    next(error);
  };
};

/**
 * Rate Limit Audit Middleware
 */
const createRateLimitAuditMiddleware = (securityLogger) => {
  return (req, res, next) => {
    if (req.rateLimit && req.rateLimit.remaining === 0) {
      securityLogger.logViolation(securityEvents.RATE_LIMIT_EXCEEDED, req, {
        limit: req.rateLimit.limit,
        reset: new Date(req.rateLimit.resetTime)
      });
    }

    next();
  };
};

/**
 * Session Audit Middleware
 */
const createSessionAuditMiddleware = (securityLogger) => {
  return (req, res, next) => {
    // Log session events
    if (req.session) {
      if (req.session.isNew) {
        securityLogger.logAuth('SESSION_CREATED', req);
      }

      // Monitor session changes
      const originalSave = req.session.save;
      req.session.save = function(callback) {
        securityLogger.logAuth('SESSION_UPDATED', req);
        originalSave.call(this, callback);
      };

      const originalDestroy = req.session.destroy;
      req.session.destroy = function(callback) {
        securityLogger.logAuth('SESSION_DESTROYED', req);
        originalDestroy.call(this, callback);
      };
    }

    next();
  };
};

// Create default security logger instance
const defaultSecurityLogger = new SecurityLogger();

module.exports = {
  SecurityLogger,
  securityEvents,
  createSecurityAuditMiddleware,
  createErrorAuditMiddleware,
  createRateLimitAuditMiddleware,
  createSessionAuditMiddleware,
  defaultSecurityLogger
};