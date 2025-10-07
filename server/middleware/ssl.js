/**
 * SMETA360-2 SSL/TLS Configuration
 * Phase 4 Step 3: Security Hardening - SSL Configuration
 *
 * SSL certificate management and secure connection configuration
 */

const fs = require('fs');
const crypto = require('crypto');

/**
 * SSL Configuration Class
 */
class SSLConfig {
  constructor(options = {}) {
    this.options = {
      // Certificate paths
      certPath: options.certPath || process.env.SSL_CERT_PATH,
      keyPath: options.keyPath || process.env.SSL_KEY_PATH,
      caPath: options.caPath || process.env.SSL_CA_PATH,
      
      // SSL/TLS settings
      minVersion: options.minVersion || 'TLSv1.2',
      maxVersion: options.maxVersion || 'TLSv1.3',
      ciphers: options.ciphers || this.getSecureCiphers(),
      honorCipherOrder: options.honorCipherOrder !== false,
      
      // Certificate validation
      requestCert: options.requestCert || false,
      rejectUnauthorized: options.rejectUnauthorized !== false,
      
      // OCSP stapling
      enableOCSPStapling: options.enableOCSPStapling || false,
      
      // Certificate transparency
      enableCertificateTransparency: options.enableCertificateTransparency || false,
      
      // Auto-renewal settings
      autoRenew: options.autoRenew || false,
      renewDays: options.renewDays || 30,
      
      ...options
    };
    
    this.certificates = new Map();
    this.certificateWatchers = new Map();
  }
  
  /**
   * Get secure cipher suites
   */
  getSecureCiphers() {
    return [
      // TLS 1.3 ciphers (preferred)
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      
      // TLS 1.2 ciphers (fallback)
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-SHA384',
      'ECDHE-RSA-AES256-SHA384',
      'ECDHE-ECDSA-AES128-SHA256',
      'ECDHE-RSA-AES128-SHA256'
    ].join(':');
  }
  
  /**
   * Load SSL certificates
   */
  async loadCertificates(domain = 'default') {
    try {
      const certPath = this.resolveCertPath(this.options.certPath, domain);
      const keyPath = this.resolveCertPath(this.options.keyPath, domain);
      const caPath = this.options.caPath ? this.resolveCertPath(this.options.caPath, domain) : null;
      
      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        throw new Error(`SSL certificates not found for domain: ${domain}`);
      }
      
      const cert = fs.readFileSync(certPath, 'utf8');
      const key = fs.readFileSync(keyPath, 'utf8');
      const ca = caPath && fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : null;
      
      // Validate certificate
      await this.validateCertificate(cert, key);
      
      const certificateData = {
        cert,
        key,
        ca,
        domain,
        loadedAt: new Date(),
        expiresAt: this.getCertificateExpiry(cert)
      };
      
      this.certificates.set(domain, certificateData);
      
      // Setup file watching for auto-reload
      this.watchCertificateFiles(domain, certPath, keyPath, caPath);
      
      console.log(`SSL certificates loaded for domain: ${domain}`);
      console.log(`Certificate expires: ${certificateData.expiresAt}`);
      
      return certificateData;
      
    } catch (error) {
      console.error(`Failed to load SSL certificates for ${domain}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Resolve certificate path with domain substitution
   */
  resolveCertPath(templatePath, domain) {
    if (!templatePath) return null;
    return templatePath.replace('{domain}', domain);
  }
  
  /**
   * Validate certificate and key pair
   */
  async validateCertificate(cert, key) {
    try {
      // Create test TLS context to validate cert/key pair
      const context = require('tls').createSecureContext({
        cert: cert,
        key: key
      });
      
      // If we reach here, cert/key pair is valid
      return true;
      
    } catch (error) {
      throw new Error(`Invalid certificate/key pair: ${error.message}`);
    }
  }
  
  /**
   * Get certificate expiry date
   */
  getCertificateExpiry(cert) {
    try {
      const match = cert.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/);
      if (!match) throw new Error('Invalid certificate format');
      
      const certData = match[1].replace(/\s/g, '');
      const derCert = Buffer.from(certData, 'base64');
      
      // Parse certificate (simplified - in production use proper ASN.1 parser)
      // This is a basic implementation - consider using node-forge or similar
      const crypto = require('crypto');
      const x509 = new crypto.X509Certificate(cert);
      
      return new Date(x509.validTo);
      
    } catch (error) {
      console.warn('Could not parse certificate expiry:', error.message);
      return null;
    }
  }
  
  /**
   * Watch certificate files for changes
   */
  watchCertificateFiles(domain, certPath, keyPath, caPath) {
    const watchedFiles = [certPath, keyPath];
    if (caPath) watchedFiles.push(caPath);
    
    // Remove existing watchers
    if (this.certificateWatchers.has(domain)) {
      this.certificateWatchers.get(domain).forEach(watcher => watcher.close());
    }
    
    const watchers = watchedFiles.map(filePath => {
      return fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          console.log(`Certificate file changed: ${filePath}`);
          setTimeout(() => {
            this.reloadCertificates(domain);
          }, 1000); // Delay to ensure file write is complete
        }
      });
    });
    
    this.certificateWatchers.set(domain, watchers);
  }
  
  /**
   * Reload certificates for a domain
   */
  async reloadCertificates(domain) {
    try {
      console.log(`Reloading certificates for domain: ${domain}`);
      await this.loadCertificates(domain);
      console.log(`Certificates reloaded successfully for domain: ${domain}`);
      
      // Emit event for server restart if needed
      process.emit('certificatesReloaded', domain);
      
    } catch (error) {
      console.error(`Failed to reload certificates for ${domain}:`, error.message);
    }
  }
  
  /**
   * Get SSL options for HTTPS server
   */
  getSSLOptions(domain = 'default') {
    const certificateData = this.certificates.get(domain);
    
    if (!certificateData) {
      throw new Error(`No certificates loaded for domain: ${domain}`);
    }
    
    const options = {
      cert: certificateData.cert,
      key: certificateData.key,
      ca: certificateData.ca,
      
      // TLS version constraints
      minVersion: this.options.minVersion,
      maxVersion: this.options.maxVersion,
      
      // Cipher configuration
      ciphers: this.options.ciphers,
      honorCipherOrder: this.options.honorCipherOrder,
      
      // Client certificate settings
      requestCert: this.options.requestCert,
      rejectUnauthorized: this.options.rejectUnauthorized,
      
      // Security settings
      secureProtocol: 'TLS_method',
      secureOptions: this.getSecureOptions(),
      
      // Session settings
      sessionIdContext: crypto.createHash('sha1').update(domain).digest('hex').slice(0, 32)
    };
    
    return options;
  }
  
  /**
   * Get secure options flags
   */
  getSecureOptions() {
    const constants = require('constants');
    
    let options = 0;
    
    // Disable vulnerable protocols
    options |= constants.SSL_OP_NO_SSLv2;
    options |= constants.SSL_OP_NO_SSLv3;
    options |= constants.SSL_OP_NO_TLSv1;
    options |= constants.SSL_OP_NO_TLSv1_1;
    
    // Security improvements
    options |= constants.SSL_OP_NO_COMPRESSION; // Disable compression (CRIME attack)
    options |= constants.SSL_OP_CIPHER_SERVER_PREFERENCE; // Honor server cipher order
    options |= constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;
    
    // Disable vulnerable features
    if (constants.SSL_OP_NO_RENEGOTIATION) {
      options |= constants.SSL_OP_NO_RENEGOTIATION;
    }
    
    return options;
  }
  
  /**
   * Create SNI callback for multi-domain support
   */
  createSNICallback() {
    return (servername, callback) => {
      try {
        const certificateData = this.certificates.get(servername) || 
                               this.certificates.get('default');
        
        if (!certificateData) {
          return callback(new Error(`No certificate found for ${servername}`));
        }
        
        const context = require('tls').createSecureContext({
          cert: certificateData.cert,
          key: certificateData.key,
          ca: certificateData.ca
        });
        
        callback(null, context);
        
      } catch (error) {
        callback(error);
      }
    };
  }
  
  /**
   * Check certificate expiry and send alerts
   */
  checkCertificateExpiry() {
    const now = new Date();
    const warningDays = this.options.renewDays;
    
    for (const [domain, certificateData] of this.certificates.entries()) {
      if (certificateData.expiresAt) {
        const daysUntilExpiry = Math.ceil((certificateData.expiresAt - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 0) {
          console.error(`Certificate EXPIRED for domain: ${domain}`);
          process.emit('certificateExpired', domain, certificateData);
        } else if (daysUntilExpiry <= warningDays) {
          console.warn(`Certificate expires in ${daysUntilExpiry} days for domain: ${domain}`);
          process.emit('certificateExpiring', domain, certificateData, daysUntilExpiry);
        }
      }
    }
  }
  
  /**
   * Generate self-signed certificate for development
   */
  generateSelfSignedCertificate(domain = 'localhost') {
    const { generateKeyPairSync } = require('crypto');
    const forge = require('node-forge'); // Optional dependency
    
    try {
      // Generate key pair
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Create certificate (simplified version - use node-forge for full implementation)
      const cert = this.createSelfSignedCert(publicKey, privateKey, domain);
      
      return {
        cert: cert,
        key: privateKey,
        domain: domain
      };
      
    } catch (error) {
      console.error('Failed to generate self-signed certificate:', error.message);
      throw error;
    }
  }
  
  /**
   * Create self-signed certificate (simplified)
   */
  createSelfSignedCert(publicKey, privateKey, domain) {
    // This is a simplified implementation
    // In production, use proper certificate generation libraries
    console.warn('Using simplified self-signed certificate generation');
    console.warn('For production, use proper CA-signed certificates');
    
    // Return a basic certificate structure
    // In reality, you'd use node-forge or similar to create proper X.509 certificates
    return `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/heBjcOUMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjUxMDA3MDAwMDAwWhcNMjYxMDA3MDAwMDAwWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAuAifiKnhkJG2+GlcPrHHa4hXPLYtEJ8N+9eD8YJW9z8GvjZRYz+8ByFv
...
-----END CERTIFICATE-----`;
  }
  
  /**
   * Start certificate monitoring
   */
  startMonitoring() {
    // Check certificate expiry every day
    const monitoringInterval = setInterval(() => {
      this.checkCertificateExpiry();
    }, 24 * 60 * 60 * 1000);
    
    // Initial check
    this.checkCertificateExpiry();
    
    return monitoringInterval;
  }
  
  /**
   * Get certificate information
   */
  getCertificateInfo(domain = 'default') {
    const certificateData = this.certificates.get(domain);
    
    if (!certificateData) {
      return null;
    }
    
    return {
      domain: certificateData.domain,
      loadedAt: certificateData.loadedAt,
      expiresAt: certificateData.expiresAt,
      daysUntilExpiry: certificateData.expiresAt ? 
        Math.ceil((certificateData.expiresAt - new Date()) / (1000 * 60 * 60 * 24)) : null,
      hasCertificate: !!certificateData.cert,
      hasPrivateKey: !!certificateData.key,
      hasCA: !!certificateData.ca
    };
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    // Close all file watchers
    for (const watchers of this.certificateWatchers.values()) {
      watchers.forEach(watcher => watcher.close());
    }
    
    this.certificateWatchers.clear();
    this.certificates.clear();
  }
}

/**
 * Security Headers for SSL/TLS
 */
const sslSecurityHeaders = (req, res, next) => {
  // Only add HTTPS-specific headers if using HTTPS
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
    // Strict Transport Security
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Upgrade insecure requests
    res.setHeader('Content-Security-Policy', 'upgrade-insecure-requests');
    
    // Expect-CT header for certificate transparency
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }
  
  next();
};

/**
 * HTTPS Redirect Middleware
 */
const httpsRedirect = (req, res, next) => {
  if (!req.secure && req.get('X-Forwarded-Proto') !== 'https' && process.env.NODE_ENV === 'production') {
    const redirectUrl = `https://${req.get('Host')}${req.url}`;
    return res.redirect(301, redirectUrl);
  }
  
  next();
};

module.exports = {
  SSLConfig,
  sslSecurityHeaders,
  httpsRedirect
};