/**
 * SMETA360-2 Security Configuration
 * Phase 4 Step 3: Security Hardening - Main Security Integration
 *
 * Central security configuration and middleware integration
 */

const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const compression = require('compression');
const hpp = require('hpp');

// Import security modules
const { SSLConfig, sslSecurityHeaders, httpsRedirect } = require('./ssl');
const security = require('./security');
const waf = require('./waf');
const { sanitizeInput, sqlInjectionProtection, noSQLInjectionProtection } = require('./validation');
const { createSecurityAuditMiddleware, defaultSecurityLogger } = require('./audit');

/**
 * Security Configuration Class
 */
class SecurityConfig {
  constructor(app, options = {}) {
    this.app = app;
    this.options = {
      // Environment
      env: process.env.NODE_ENV || 'development',
      
      // SSL/TLS options
      ssl: {
        enabled: process.env.SSL_ENABLED === 'true' || false,
        certPath: process.env.SSL_CERT_PATH,
        keyPath: process.env.SSL_KEY_PATH,
        caPath: process.env.SSL_CA_PATH
      },
      
      // Session options
      session: {
        secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          sameSite: 'strict'
        },
        store: null // Will be configured based on environment
      },
      
      // Rate limiting
      rateLimitEnabled: true,
      
      // WAF settings
      wafEnabled: true,
      
      // Security headers
      securityHeaders: true,
      
      // Input validation
      inputValidation: true,
      
      // Audit logging
      auditLogging: true,
      
      ...options
    };
    
    this.sslConfig = null;
    this.securityLogger = defaultSecurityLogger;
  }
  
  /**
   * Initialize complete security configuration
   */
  async initialize() {
    console.log('🔒 Initializing SMETA360-2 Security Configuration...');
    
    try {
      // 1. Basic security middleware
      this.setupBasicSecurity();
      
      // 2. SSL/TLS configuration
      if (this.options.ssl.enabled) {
        await this.setupSSL();
      }
      
      // 3. Session management
      this.setupSessionManagement();
      
      // 4. Rate limiting
      if (this.options.rateLimitEnabled) {
        this.setupRateLimiting();
      }
      
      // 5. WAF (Web Application Firewall)
      if (this.options.wafEnabled) {
        this.setupWAF();
      }
      
      // 6. Input validation and sanitization
      if (this.options.inputValidation) {
        this.setupInputValidation();
      }
      
      // 7. Security audit logging
      if (this.options.auditLogging) {
        this.setupAuditLogging();
      }
      
      // 8. Error handling
      this.setupErrorHandling();
      
      console.log('✅ Security configuration initialized successfully');
      
      // Log system start
      this.securityLogger.logSystem('SYSTEM_START', {
        environment: this.options.env,
        sslEnabled: this.options.ssl.enabled,
        wafEnabled: this.options.wafEnabled,
        rateLimitEnabled: this.options.rateLimitEnabled
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize security configuration:', error);
      throw error;
    }
  }
  
  /**
   * Setup basic security middleware
   */
  setupBasicSecurity() {
    console.log('🛡️ Setting up basic security middleware...');
    
    // Helmet for security headers
    if (this.options.securityHeaders) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: this.options.env === 'production' ? [] : null
          }
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }));
    }
    
    // HTTPS redirect in production
    if (this.options.env === 'production') {
      this.app.use(httpsRedirect);
    }
    
    // SSL security headers
    this.app.use(sslSecurityHeaders);
    
    // Compression with security considerations
    this.app.use(compression({
      filter: (req, res) => {
        // Don't compress if it might leak information
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));
    
    // HPP (HTTP Parameter Pollution) protection
    this.app.use(hpp({
      whitelist: ['tags', 'categories', 'filters'] // Allow arrays for these parameters
    }));
    
    // Remove sensitive headers
    this.app.use((req, res, next) => {
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      next();
    });
  }
  
  /**
   * Setup SSL/TLS configuration
   */
  async setupSSL() {
    console.log('🔐 Setting up SSL/TLS configuration...');
    
    this.sslConfig = new SSLConfig(this.options.ssl);
    
    try {
      await this.sslConfig.loadCertificates();
      console.log('✅ SSL certificates loaded successfully');
    } catch (error) {
      console.warn('⚠️ SSL certificates not found, using self-signed for development');
      
      // Generate self-signed certificate for development
      if (this.options.env === 'development') {
        const selfSigned = this.sslConfig.generateSelfSignedCertificate();
        console.log('🔑 Self-signed certificate generated for development');
      }
    }
  }
  
  /**
   * Setup session management
   */
  setupSessionManagement() {
    console.log('🎫 Setting up session management...');
    
    // Configure session store based on environment
    if (this.options.env === 'production') {
      // Use MongoDB store for production
      if (process.env.MONGODB_URI) {
        this.options.session.store = MongoStore.create({
          mongoUrl: process.env.MONGODB_URI,
          touchAfter: 24 * 3600, // Lazy session update
          crypto: {
            secret: this.options.session.secret
          }
        });
      }
    }
    
    // Apply session middleware
    this.app.use(session(this.options.session));
    
    // Session security monitoring
    this.app.use((req, res, next) => {
      if (req.session) {
        // Detect session hijacking attempts
        const userAgent = req.get('User-Agent');
        const ip = req.ip;
        
        if (req.session.userAgent && req.session.userAgent !== userAgent) {
          this.securityLogger.logViolation('SESSION_HIJACK_ATTEMPT', req, {
            storedUserAgent: req.session.userAgent,
            currentUserAgent: userAgent
          });
          
          // Destroy potentially hijacked session
          req.session.destroy();
          return res.status(401).json({ error: 'Session security violation' });
        }
        
        if (req.session.ip && req.session.ip !== ip) {
          this.securityLogger.logViolation('SESSION_IP_CHANGE', req, {
            storedIP: req.session.ip,
            currentIP: ip
          });
        }
        
        // Store security markers
        req.session.userAgent = userAgent;
        req.session.ip = ip;
        req.session.lastActivity = Date.now();
      }
      
      next();
    });
  }
  
  /**
   * Setup rate limiting
   */
  setupRateLimiting() {
    console.log('⏱️ Setting up rate limiting...');
    
    // Apply security rate limiting middleware
    this.app.use(security.rateLimitGeneral);
    this.app.use('/api/auth', security.rateLimitAuth);
    this.app.use('/api/auth/reset-password', security.rateLimitPasswordReset);
  }
  
  /**
   * Setup Web Application Firewall
   */
  setupWAF() {
    console.log('🔥 Setting up Web Application Firewall...');
    
    // Apply WAF middleware
    this.app.use(waf.botProtection);
    this.app.use(waf.ddosProtection);
    this.app.use(waf.geoblockingMiddleware);
    this.app.use(waf.suspiciousPatternDetection);
    this.app.use(waf.ipBlacklistMiddleware);
  }
  
  /**
   * Setup input validation and sanitization
   */
  setupInputValidation() {
    console.log('🧹 Setting up input validation and sanitization...');
    
    // Apply input sanitization
    this.app.use(sanitizeInput);
    
    // SQL injection protection
    this.app.use(sqlInjectionProtection);
    
    // NoSQL injection protection
    this.app.use(noSQLInjectionProtection);
    
    // XSS protection middleware
    this.app.use(security.xssProtection);
    
    // Input validation middleware
    this.app.use(security.inputValidation);
  }
  
  /**
   * Setup audit logging
   */
  setupAuditLogging() {
    console.log('📝 Setting up security audit logging...');
    
    // Apply audit middleware
    this.app.use(createSecurityAuditMiddleware(this.securityLogger));
  }
  
  /**
   * Setup error handling
   */
  setupErrorHandling() {
    console.log('🚨 Setting up security error handling...');
    
    // Security-aware error handler
    this.app.use((error, req, res, next) => {
      // Log security-related errors
      this.securityLogger.logSecurityEvent('ERROR', {
        ...this.securityLogger.extractRequestInfo(req),
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        }
      }, 'error');
      
      // Don't expose sensitive error information in production
      if (this.options.env === 'production') {
        res.status(500).json({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      } else {
        res.status(500).json({
          error: error.message,
          stack: error.stack,
          code: error.code || 'INTERNAL_ERROR'
        });
      }
    });
    
    // 404 handler
    this.app.use((req, res) => {
      this.securityLogger.logSecurityEvent('NOT_FOUND', {
        ...this.securityLogger.extractRequestInfo(req)
      }, 'warn');
      
      res.status(404).json({
        error: 'Resource not found',
        code: 'NOT_FOUND'
      });
    });
  }
  
  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      environment: this.options.env,
      ssl: {
        enabled: this.options.ssl.enabled,
        certificates: this.sslConfig ? 
          Array.from(this.sslConfig.certificates.keys()) : []
      },
      waf: {
        enabled: this.options.wafEnabled
      },
      rateLimit: {
        enabled: this.options.rateLimitEnabled
      },
      session: {
        configured: !!this.options.session.store,
        secure: this.options.session.cookie.secure
      },
      auditLogging: {
        enabled: this.options.auditLogging
      }
    };
  }
  
  /**
   * Cleanup security resources
   */
  cleanup() {
    console.log('🧹 Cleaning up security resources...');
    
    if (this.sslConfig) {
      this.sslConfig.cleanup();
    }
    
    this.securityLogger.logSystem('SYSTEM_SHUTDOWN');
  }
}

module.exports = {
  SecurityConfig
};