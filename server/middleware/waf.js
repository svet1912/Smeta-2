/**
 * SMETA360-2 WAF (Web Application Firewall) Configuration
 * Phase 4 Step 3: Security Hardening - WAF Implementation
 * 
 * Cloud-based and application-level firewall rules for enhanced security
 */

/**
 * AWS WAF Configuration (Terraform)
 * This configuration would be used in terraform/modules/security/waf.tf
 */
const awsWafConfig = {
  webAclName: 'smeta360-waf',
  
  // Rule groups and rules
  rules: [
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 1,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet'
        }
      },
      action: 'block'
    },
    {
      name: 'AWSManagedRulesKnownBadInputsRuleSet',
      priority: 2,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesKnownBadInputsRuleSet'
        }
      },
      action: 'block'
    },
    {
      name: 'AWSManagedRulesSQLiRuleSet',
      priority: 3,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesSQLiRuleSet'
        }
      },
      action: 'block'
    },
    {
      name: 'RateLimitRule',
      priority: 4,
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP'
        }
      },
      action: 'block'
    },
    {
      name: 'GeoBlockingRule',
      priority: 5,
      statement: {
        geoMatchStatement: {
          countryCodes: ['CN', 'RU', 'KP', 'IR'] // Block high-risk countries
        }
      },
      action: 'block'
    },
    {
      name: 'CustomBlacklistRule',
      priority: 6,
      statement: {
        ipSetReferenceStatement: {
          arn: 'arn:aws:wafv2:region:account:ipset/custom-blacklist'
        }
      },
      action: 'block'
    }
  ],
  
  // Default action
  defaultAction: 'allow',
  
  // CloudWatch metrics
  cloudWatchMetricsEnabled: true,
  metricName: 'smeta360WAF',
  
  // Logging configuration
  loggingConfiguration: {
    logDestinationConfigs: [
      'arn:aws:logs:region:account:log-group:aws-waf-logs-smeta360'
    ],
    redactedFields: [
      {
        singleHeader: {
          name: 'authorization'
        }
      },
      {
        singleHeader: {
          name: 'cookie'
        }
      }
    ]
  }
};

/**
 * Application-Level WAF Implementation
 */
class ApplicationWAF {
  constructor(options = {}) {
    this.options = {
      enableGeoBlocking: options.enableGeoBlocking || false,
      blockedCountries: options.blockedCountries || ['CN', 'RU', 'KP', 'IR'],
      enableBotProtection: options.enableBotProtection || true,
      enableDDoSProtection: options.enableDDoSProtection || true,
      suspiciousUserAgents: options.suspiciousUserAgents || [
        'sqlmap',
        'nikto',
        'nmap',
        'masscan',
        'zap',
        'gobuster',
        'dirb',
        'dirbuster'
      ],
      maxRequestSize: options.maxRequestSize || 10 * 1024 * 1024, // 10MB
      ...options
    };
    
    // In-memory storage for tracking (use Redis in production)
    this.requestCounts = new Map();
    this.blacklistedIPs = new Set();
    this.whitelistedIPs = new Set(['127.0.0.1', '::1']);
    this.suspiciousIPs = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }
  
  /**
   * Main WAF middleware
   */
  middleware() {
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);
      const userAgent = req.get('User-Agent') || '';
      const requestSize = parseInt(req.get('Content-Length')) || 0;
      
      try {
        // 1. IP Whitelist check
        if (this.whitelistedIPs.has(clientIP)) {
          return next();
        }
        
        // 2. IP Blacklist check
        if (this.blacklistedIPs.has(clientIP)) {
          this.logSecurityEvent('IP_BLACKLISTED', req, { ip: clientIP });
          return this.blockRequest(res, 'IP blacklisted', 'IP_BLACKLISTED');
        }
        
        // 3. Geographic blocking
        if (this.options.enableGeoBlocking) {
          const geoBlock = this.checkGeoBlocking(req);
          if (geoBlock.blocked) {
            this.logSecurityEvent('GEO_BLOCKED', req, geoBlock);
            return this.blockRequest(res, 'Geographic restriction', 'GEO_BLOCKED');
          }
        }
        
        // 4. Bot protection
        if (this.options.enableBotProtection) {
          const botCheck = this.checkBotProtection(req, userAgent);
          if (botCheck.blocked) {
            this.logSecurityEvent('BOT_BLOCKED', req, botCheck);
            return this.blockRequest(res, 'Bot detected', 'BOT_BLOCKED');
          }
        }
        
        // 5. Request size validation
        if (requestSize > this.options.maxRequestSize) {
          this.logSecurityEvent('REQUEST_TOO_LARGE', req, { size: requestSize });
          return this.blockRequest(res, 'Request too large', 'REQUEST_TOO_LARGE');
        }
        
        // 6. DDoS protection
        if (this.options.enableDDoSProtection) {
          const ddosCheck = this.checkDDoSProtection(req, clientIP);
          if (ddosCheck.blocked) {
            this.logSecurityEvent('DDOS_DETECTED', req, ddosCheck);
            return this.blockRequest(res, 'Too many requests', 'DDOS_DETECTED');
          }
        }
        
        // 7. Suspicious pattern detection
        const patternCheck = this.checkSuspiciousPatterns(req);
        if (patternCheck.blocked) {
          this.logSecurityEvent('SUSPICIOUS_PATTERN', req, patternCheck);
          this.addSuspiciousIP(clientIP, patternCheck.reason);
          return this.blockRequest(res, 'Suspicious request pattern', 'SUSPICIOUS_PATTERN');
        }
        
        // 8. HTTP method validation
        const methodCheck = this.checkHTTPMethod(req);
        if (methodCheck.blocked) {
          this.logSecurityEvent('INVALID_HTTP_METHOD', req, methodCheck);
          return this.blockRequest(res, 'Invalid HTTP method', 'INVALID_HTTP_METHOD');
        }
        
        // Request passed all checks
        next();
        
      } catch (error) {
        console.error('WAF middleware error:', error);
        // Fail open - allow request but log error
        this.logSecurityEvent('WAF_ERROR', req, { error: error.message });
        next();
      }
    };
  }
  
  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '0.0.0.0';
  }
  
  /**
   * Geographic blocking check
   */
  checkGeoBlocking(req) {
    // In production, integrate with GeoIP service
    const country = req.get('CF-IPCountry') || req.get('X-Country-Code');
    
    if (country && this.options.blockedCountries.includes(country.toUpperCase())) {
      return {
        blocked: true,
        reason: 'Geographic restriction',
        country: country
      };
    }
    
    return { blocked: false };
  }
  
  /**
   * Bot protection check
   */
  checkBotProtection(req, userAgent) {
    // Check for suspicious user agents
    const lowerUserAgent = userAgent.toLowerCase();
    
    for (const suspicious of this.options.suspiciousUserAgents) {
      if (lowerUserAgent.includes(suspicious.toLowerCase())) {
        return {
          blocked: true,
          reason: 'Suspicious user agent',
          userAgent: userAgent,
          pattern: suspicious
        };
      }
    }
    
    // Check for empty or very short user agents
    if (!userAgent || userAgent.length < 10) {
      return {
        blocked: true,
        reason: 'Invalid user agent',
        userAgent: userAgent
      };
    }
    
    // Check for known bot patterns
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|php/i,
      /automated|headless/i
    ];
    
    // Allow legitimate bots (Google, Bing, etc.)
    const legitimateBots = [
      /googlebot/i,
      /bingbot/i,
      /slurp/i,
      /duckduckbot/i,
      /baiduspider/i,
      /yandexbot/i,
      /facebookexternalhit/i,
      /twitterbot/i,
      /linkedinbot/i
    ];
    
    // Check if it's a legitimate bot
    for (const pattern of legitimateBots) {
      if (pattern.test(userAgent)) {
        return { blocked: false };
      }
    }
    
    // Check for suspicious bot patterns
    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        return {
          blocked: true,
          reason: 'Bot detected',
          userAgent: userAgent
        };
      }
    }
    
    return { blocked: false };
  }
  
  /**
   * DDoS protection check
   */
  checkDDoSProtection(req, clientIP) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 100; // Max requests per minute per IP
    
    if (!this.requestCounts.has(clientIP)) {
      this.requestCounts.set(clientIP, []);
    }
    
    const requests = this.requestCounts.get(clientIP);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    validRequests.push(now);
    
    this.requestCounts.set(clientIP, validRequests);
    
    if (validRequests.length > maxRequests) {
      // Add to blacklist for repeated offenses
      this.blacklistedIPs.add(clientIP);
      
      return {
        blocked: true,
        reason: 'DDoS protection triggered',
        requestCount: validRequests.length,
        maxRequests: maxRequests,
        windowMs: windowMs
      };
    }
    
    return { blocked: false };
  }
  
  /**
   * Suspicious pattern detection
   */
  checkSuspiciousPatterns(req) {
    const checks = [
      // SQL injection patterns in URL
      {
        pattern: /(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bcreate\b)/i,
        target: req.url,
        reason: 'SQL injection pattern in URL'
      },
      
      // XSS patterns in URL
      {
        pattern: /<script|javascript:|on\w+=/i,
        target: req.url,
        reason: 'XSS pattern in URL'
      },
      
      // Path traversal
      {
        pattern: /\.\.[\/\\]|[\/\\]\.\.[\/\\]/,
        target: req.url,
        reason: 'Path traversal pattern'
      },
      
      // Command injection
      {
        pattern: /[;&|`$]\s*(nc|netcat|wget|curl|bash|sh|cmd)/i,
        target: req.url,
        reason: 'Command injection pattern'
      },
      
      // Excessive query parameters
      {
        condition: () => Object.keys(req.query || {}).length > 50,
        reason: 'Excessive query parameters'
      },
      
      // Very long URL
      {
        condition: () => req.url.length > 2048,
        reason: 'Excessively long URL'
      },
      
      // Suspicious headers
      {
        condition: () => {
          const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
          return suspiciousHeaders.some(header => {
            const value = req.get(header);
            return value && value.split(',').length > 10;
          });
        },
        reason: 'Suspicious header manipulation'
      }
    ];
    
    for (const check of checks) {
      if (check.pattern && check.target && check.pattern.test(check.target)) {
        return {
          blocked: true,
          reason: check.reason,
          pattern: check.pattern.toString(),
          target: check.target
        };
      }
      
      if (check.condition && check.condition()) {
        return {
          blocked: true,
          reason: check.reason
        };
      }
    }
    
    return { blocked: false };
  }
  
  /**
   * HTTP method validation
   */
  checkHTTPMethod(req) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'];
    
    if (!allowedMethods.includes(req.method.toUpperCase())) {
      return {
        blocked: true,
        reason: 'Invalid HTTP method',
        method: req.method
      };
    }
    
    // Block dangerous methods on production
    if (process.env.NODE_ENV === 'production') {
      const dangerousMethods = ['TRACE', 'CONNECT'];
      if (dangerousMethods.includes(req.method.toUpperCase())) {
        return {
          blocked: true,
          reason: 'Dangerous HTTP method',
          method: req.method
        };
      }
    }
    
    return { blocked: false };
  }
  
  /**
   * Add suspicious IP to tracking
   */
  addSuspiciousIP(ip, reason) {
    if (!this.suspiciousIPs.has(ip)) {
      this.suspiciousIPs.set(ip, []);
    }
    
    const incidents = this.suspiciousIPs.get(ip);
    incidents.push({
      timestamp: Date.now(),
      reason: reason
    });
    
    // If more than 3 incidents in 10 minutes, blacklist
    const recentIncidents = incidents.filter(
      incident => Date.now() - incident.timestamp < 10 * 60 * 1000
    );
    
    if (recentIncidents.length >= 3) {
      this.blacklistedIPs.add(ip);
      this.logSecurityEvent('IP_AUTO_BLACKLISTED', null, {
        ip: ip,
        incidents: recentIncidents
      });
    }
  }
  
  /**
   * Block request with appropriate response
   */
  blockRequest(res, message, code) {
    res.status(403).json({
      error: message,
      code: code,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log security events
   */
  logSecurityEvent(eventType, req, details) {
    const logData = {
      eventType,
      timestamp: new Date().toISOString(),
      ip: req ? this.getClientIP(req) : 'unknown',
      userAgent: req ? req.get('User-Agent') : 'unknown',
      url: req ? req.url : 'unknown',
      method: req ? req.method : 'unknown',
      ...details
    };
    
    console.warn(`WAF Security Event [${eventType}]:`, logData);
    
    // In production, send to security monitoring system
    // Example: Send to SIEM, security dashboard, or alert system
  }
  
  /**
   * Cleanup old data
   */
  cleanup() {
    const now = Date.now();
    const cleanupAge = 60 * 60 * 1000; // 1 hour
    
    // Cleanup request counts
    for (const [ip, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < cleanupAge);
      if (validRequests.length === 0) {
        this.requestCounts.delete(ip);
      } else {
        this.requestCounts.set(ip, validRequests);
      }
    }
    
    // Cleanup suspicious IPs
    for (const [ip, incidents] of this.suspiciousIPs.entries()) {
      const recentIncidents = incidents.filter(
        incident => now - incident.timestamp < cleanupAge
      );
      if (recentIncidents.length === 0) {
        this.suspiciousIPs.delete(ip);
      } else {
        this.suspiciousIPs.set(ip, recentIncidents);
      }
    }
  }
  
  /**
   * Manual IP whitelist/blacklist management
   */
  whitelistIP(ip) {
    this.whitelistedIPs.add(ip);
    this.blacklistedIPs.delete(ip);
    this.logSecurityEvent('IP_WHITELISTED', null, { ip });
  }
  
  blacklistIP(ip, reason = 'manual') {
    this.blacklistedIPs.add(ip);
    this.logSecurityEvent('IP_BLACKLISTED', null, { ip, reason });
  }
  
  removeFromBlacklist(ip) {
    this.blacklistedIPs.delete(ip);
    this.logSecurityEvent('IP_REMOVED_FROM_BLACKLIST', null, { ip });
  }
  
  /**
   * Get WAF statistics
   */
  getStats() {
    return {
      blacklistedIPs: Array.from(this.blacklistedIPs),
      whitelistedIPs: Array.from(this.whitelistedIPs),
      activeRequestCounts: this.requestCounts.size,
      suspiciousIPs: this.suspiciousIPs.size,
      totalRequestsTracked: Array.from(this.requestCounts.values())
        .reduce((total, requests) => total + requests.length, 0)
    };
  }
  
  /**
   * Destroy WAF instance
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = {
  ApplicationWAF,
  awsWafConfig
};