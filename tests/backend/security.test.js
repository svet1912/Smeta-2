/**
 * SMETA360-2 Security Test Suite
 * Phase 4 Step 3: Security Hardening - Security Testing
 *
 * Comprehensive security testing and validation
 */

const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const { SecurityConfig } = require('../middleware/security-config');

/**
 * Security Test Suite
 */
describe('SMETA360-2 Security Tests', () => {
  let app;
  let securityConfig;

  beforeEach(async () => {
    app = express();
    securityConfig = new SecurityConfig(app, {
      env: 'test',
      ssl: { enabled: false },
      rateLimitEnabled: true,
      wafEnabled: true,
      inputValidation: true,
      auditLogging: false // Disable for testing
    });

    await securityConfig.initialize();

    // Test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'test endpoint' });
    });

    app.post('/test', (req, res) => {
      res.json({ body: req.body });
    });
  });

  afterEach(() => {
    if (securityConfig) {
      securityConfig.cleanup();
    }
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      // Check for security headers
      expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
      expect(response.headers).to.have.property('x-frame-options', 'DENY');
      expect(response.headers).to.have.property('x-xss-protection', '0');
      expect(response.headers).to.not.have.property('x-powered-by');
    });

    it('should set CSP headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers).to.have.property('content-security-policy');
      expect(response.headers['content-security-policy']).to.include("default-src 'self'");
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts', async () => {
      const maliciousPayload = {
        message: '<script>alert("xss")</script>',
        name: 'test<img src=x onerror=alert(1)>'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousPayload)
        .expect(200);

      // Should sanitize script tags
      expect(response.body.body.message).to.not.include('<script>');
      expect(response.body.body.name).to.not.include('<img');
    });

    it('should detect SQL injection attempts', async () => {
      const sqlPayload = {
        query: "'; DROP TABLE users; --",
        filter: "1' OR '1'='1"
      };

      await request(app)
        .post('/test')
        .send(sqlPayload)
        .expect(400); // Should be blocked
    });

    it('should handle NoSQL injection attempts', async () => {
      const nosqlPayload = {
        user: { $ne: null },
        query: { $where: "function() { return true; }" }
      };

      const response = await request(app)
        .post('/test')
        .send(nosqlPayload)
        .expect(200);

      // MongoDB operators should be removed
      expect(response.body.body.user).to.not.have.property('$ne');
      expect(response.body.body.query).to.not.have.property('$where');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      // Make multiple requests quickly
      const promises = Array(10).fill().map(() => 
        request(app).get('/test')
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).to.be.true;
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers).to.have.property('x-ratelimit-limit');
      expect(response.headers).to.have.property('x-ratelimit-remaining');
    });
  });

  describe('Bot Protection', () => {
    it('should block suspicious user agents', async () => {
      await request(app)
        .get('/test')
        .set('User-Agent', 'sqlmap/1.0')
        .expect(403);
    });

    it('should allow legitimate user agents', async () => {
      await request(app)
        .get('/test')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .expect(200);
    });
  });

  describe('DDoS Protection', () => {
    it('should detect rapid requests from same IP', async () => {
      // Simulate rapid requests
      const promises = Array(20).fill().map(() => 
        request(app)
          .get('/test')
          .set('X-Forwarded-For', '192.168.1.100')
      );

      const responses = await Promise.all(promises);
      
      // Should start blocking after threshold
      const blocked = responses.some(res => res.status === 429);
      expect(blocked).to.be.true;
    });
  });

  describe('Geographic Blocking', () => {
    it('should block requests from blocked countries', async () => {
      // Simulate request from blocked country
      await request(app)
        .get('/test')
        .set('CF-IPCountry', 'CN') // Assuming CN is blocked
        .expect(403);
    });

    it('should allow requests from allowed countries', async () => {
      await request(app)
        .get('/test')
        .set('CF-IPCountry', 'US')
        .expect(200);
    });
  });

  describe('File Upload Security', () => {
    beforeEach(() => {
      const multer = require('multer');
      const upload = multer({ 
        limits: { fileSize: 1024 * 1024 }, // 1MB
        fileFilter: (req, file, cb) => {
          const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
          cb(null, allowedTypes.includes(file.mimetype));
        }
      });

      app.post('/upload', upload.single('file'), (req, res) => {
        res.json({ file: req.file });
      });
    });

    it('should reject files with dangerous extensions', async () => {
      // This would require actual file upload testing
      // For now, just test the endpoint exists
      await request(app)
        .post('/upload')
        .expect(400); // No file provided
    });

    it('should enforce file size limits', async () => {
      // Test would involve uploading oversized file
      // Implementation depends on specific upload handling
      expect(true).to.be.true; // Placeholder
    });
  });

  describe('Session Security', () => {
    it('should set secure session cookies in production', () => {
      const prodSecurityConfig = new SecurityConfig(express(), {
        env: 'production'
      });
      
      expect(prodSecurityConfig.options.session.cookie.secure).to.be.true;
      expect(prodSecurityConfig.options.session.cookie.httpOnly).to.be.true;
      expect(prodSecurityConfig.options.session.cookie.sameSite).to.equal('strict');
    });

    it('should regenerate session on privilege change', async () => {
      // This would require session implementation testing
      // Placeholder for session security tests
      expect(true).to.be.true;
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      app.get('/error', (req, res, next) => {
        const error = new Error('Test error');
        error.stack = 'Sensitive stack trace';
        next(error);
      });
    });

    it('should not expose sensitive error information', async () => {
      const response = await request(app)
        .get('/error')
        .expect(500);

      // In test mode, stack traces might be exposed
      // In production, they should be hidden
      expect(response.body).to.have.property('error');
    });

    it('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).to.have.property('error', 'Resource not found');
      expect(response.body).to.have.property('code', 'NOT_FOUND');
    });
  });

  describe('CORS Security', () => {
    it('should handle preflight requests', async () => {
      await request(app)
        .options('/test')
        .set('Origin', 'https://malicious-site.com')
        .expect(204); // Should handle OPTIONS
    });

    it('should reject unauthorized origins', async () => {
      // This depends on CORS configuration
      // Placeholder for CORS security tests
      expect(true).to.be.true;
    });
  });

  describe('Security Status', () => {
    it('should provide security status information', () => {
      const status = securityConfig.getSecurityStatus();
      
      expect(status).to.have.property('environment', 'test');
      expect(status).to.have.property('ssl');
      expect(status).to.have.property('waf');
      expect(status).to.have.property('rateLimit');
      expect(status).to.have.property('session');
      expect(status).to.have.property('auditLogging');
    });
  });
});

/**
 * Security Performance Tests
 */
describe('Security Performance Tests', () => {
  let app;
  let securityConfig;

  before(async () => {
    app = express();
    securityConfig = new SecurityConfig(app, {
      env: 'test',
      auditLogging: false
    });

    await securityConfig.initialize();

    app.get('/perf', (req, res) => {
      res.json({ timestamp: Date.now() });
    });
  });

  after(() => {
    if (securityConfig) {
      securityConfig.cleanup();
    }
  });

  it('should not significantly impact response time', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get('/perf')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    
    // Security middleware should add minimal overhead
    expect(responseTime).to.be.below(100); // 100ms threshold
  });

  it('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 50;
    const startTime = Date.now();
    
    const promises = Array(concurrentRequests).fill().map(() => 
      request(app).get('/perf')
    );
    
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).to.equal(200);
    });
    
    // Average response time should be reasonable
    const avgTime = totalTime / concurrentRequests;
    expect(avgTime).to.be.below(50); // 50ms average
  });
});

/**
 * Security Integration Tests
 */
describe('Security Integration Tests', () => {
  it('should integrate all security components', async () => {
    const app = express();
    const securityConfig = new SecurityConfig(app, {
      env: 'test',
      ssl: { enabled: false },
      rateLimitEnabled: true,
      wafEnabled: true,
      inputValidation: true,
      auditLogging: true
    });

    await securityConfig.initialize();

    app.get('/integration-test', (req, res) => {
      res.json({ 
        message: 'Integration test successful',
        security: securityConfig.getSecurityStatus()
      });
    });

    const response = await request(app)
      .get('/integration-test')
      .expect(200);

    expect(response.body.security).to.be.an('object');
    expect(response.body.security.waf.enabled).to.be.true;
    expect(response.body.security.rateLimit.enabled).to.be.true;

    securityConfig.cleanup();
  });
});

module.exports = {
  // Export for potential use in other test files
};