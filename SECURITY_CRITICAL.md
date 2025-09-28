# ⚠️ Критические проблемы безопасности SMETA360

> Отчет по выявленным уязвимостям и рекомендации по их устранению

---

## 🚨 Критические уязвимости (требуют немедленного исправления)

### 1. SQL Injection в функции фильтрации

**Расположение:** `server/index.js:330-380`  
**Уровень риска:** 🔴 КРИТИЧЕСКИЙ

```javascript
// УЯЗВИМЫЙ КОД (ТЕКУЩЕЕ СОСТОЯНИЕ)
const getFilteredMaterials = (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM materials WHERE 1=1';
  
  if (category) {
    query += ` AND category = '${category}'`;  // ❌ SQL INJECTION!
  }
  
  if (search) {
    query += ` AND name ILIKE '%${search}%'`;  // ❌ SQL INJECTION!
  }
};
```

**Исправление:**

```javascript
// ✅ БЕЗОПАСНЫЙ КОД
const getFilteredMaterials = async (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM materials WHERE 1=1';
  const params = [];
  let paramCount = 0;
  
  if (category) {
    query += ` AND category = $${++paramCount}`;
    params.push(category);
  }
  
  if (search) {
    query += ` AND name ILIKE $${++paramCount}`;
    params.push(`%${search}%`);
  }
  
  try {
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
};
```

### 2. Отсутствие Rate Limiting на критических endpoints

**Расположение:** Все authentication endpoints  
**Уровень риска:** 🔴 КРИТИЧЕСКИЙ

```javascript
// ❌ ТЕКУЩЕЕ СОСТОЯНИЕ - нет rate limiting
app.post('/api/auth/login', loginHandler);
app.post('/api/auth/register', registerHandler);
```

**Исправление:**

```javascript
// ✅ ДОБАВИТЬ RATE LIMITING
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', generalLimiter);
```

### 3. Хранение паролей в открытом виде

**Расположение:** `server/index.js:200-250`  
**Уровень риска:** 🔴 КРИТИЧЕСКИЙ

```javascript
// ❌ УЯЗВИМЫЙ КОД
const registerUser = async (req, res) => {
  const { email, password } = req.body;
  
  const result = await query(
    'INSERT INTO users (email, password) VALUES ($1, $2)',
    [email, password]  // ❌ Пароль в открытом виде!
  );
};
```

**Исправление:**

```javascript
// ✅ БЕЗОПАСНЫЙ КОД
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

const registerUser = async (req, res) => {
  const { email, password, firstname, lastname } = req.body;
  
  try {
    // Валидация пароля
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Хеширование пароля
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    const result = await query(
      'INSERT INTO users (email, password_hash, firstname, lastname) VALUES ($1, $2, $3, $4) RETURNING id, email, firstname, lastname',
      [email, passwordHash, firstname, lastname]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'User registered successfully'
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};
```

---

## 🟠 Высокие риски (требуют исправления в течение недели)

### 4. Отсутствие валидации входных данных

**Расположение:** Большинство API endpoints  
**Уровень риска:** 🟠 ВЫСОКИЙ

**Исправление с express-validator:**

```javascript
const { body, validationResult } = require('express-validator');

// Middleware для проверки ошибок валидации
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.mapped()
    });
  }
  next();
};

// Валидация регистрации
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least 8 characters with uppercase, lowercase and number'),
  
  body('firstname')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Zа-яё\s]+$/u)
    .withMessage('First name must be 2-50 characters, letters only'),
    
  handleValidationErrors
];

app.post('/api/auth/register', validateRegistration, registerUser);
```

### 5. Небезопасное хранение JWT секрета

**Расположение:** `server/config.js`  
**Уровень риска:** 🟠 ВЫСОКИЙ

```javascript
// ❌ ТЕКУЩЕЕ СОСТОЯНИЕ
const JWT_SECRET = 'simple-secret-key'; // Слабый секрет в коде!

// ✅ ИСПРАВЛЕНИЕ
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

// Генерация безопасного секрета (выполнить один раз):
// node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 6. Отсутствие HTTPS Strict Transport Security

**Расположение:** Конфигурация сервера  
**Уровень риска:** 🟠 ВЫСОКИЙ

**Исправление:**

```javascript
const helmet = require('helmet');

app.use(helmet({
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
```

---

## 🟡 Средние риски (рекомендуется исправить в течение месяца)

### 7. Отсутствие логирования безопасности

**Исправление:**

```javascript
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' })
  ]
});

// Логирование подозрительной активности
const logSecurityEvent = (req, event, details = {}) => {
  securityLogger.warn('Security Event', {
    event,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Использование в middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    logSecurityEvent(req, 'MISSING_AUTH_TOKEN');
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logSecurityEvent(req, 'INVALID_AUTH_TOKEN', { error: error.message });
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};
```

### 8. Отсутствие Content Security Policy

**Исправление в Nginx:**

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  font-src 'self' fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
" always;
```

---

## 🔧 План немедленного исправления

### Шаг 1: Критические уязвимости (выполнить сегодня)

```bash
# 1. Установка необходимых пакетов
cd server
npm install bcrypt express-rate-limit express-validator helmet winston

# 2. Генерация безопасного JWT секрета
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
# Добавить результат в .env файл

# 3. Перезапуск приложения
pm2 restart smeta360-api
```

### Шаг 2: Обновление кода (выполнить завтра)

1. **Замените все SQL запросы на параметризованные**
2. **Добавьте bcrypt хеширование паролей**
3. **Добавьте rate limiting middleware**
4. **Добавьте валидацию всех входных данных**

### Шаг 3: Тестирование безопасности (выполнить на следующей неделе)

```bash
# Установка инструментов тестирования
npm install --save-dev sqlmap-python burp-suite-community

# Тест на SQL injection
sqlmap -u "http://localhost:3001/api/materials?search=test" --batch

# Нагрузочное тестирование rate limiting
ab -n 1000 -c 10 http://localhost:3001/api/auth/login
```

---

## 🛡️ Рекомендации по улучшению безопасности

### 1. Система мониторинга безопасности

```javascript
// security-monitor.js
const monitor = {
  failedLogins: new Map(),
  
  recordFailedLogin(ip) {
    const current = this.failedLogins.get(ip) || { count: 0, firstAttempt: Date.now() };
    current.count++;
    
    if (current.count >= 5 && (Date.now() - current.firstAttempt) < 300000) {
      // 5 попыток за 5 минут - заблокировать IP
      this.blockIP(ip);
    }
    
    this.failedLogins.set(ip, current);
  },
  
  blockIP(ip) {
    console.log(`🚨 BLOCKED IP: ${ip} due to multiple failed login attempts`);
    // Реализация блокировки (iptables, fail2ban, etc.)
  }
};
```

### 2. Регулярное обновление зависимостей

```bash
# Еженедельная проверка уязвимостей
npm audit
npm audit fix

# Обновление зависимостей
npx npm-check-updates -u
npm install

# Автоматизация через GitHub Dependabot
# .github/dependabot.yml
```

### 3. Backup и восстановление

```bash
# Ежедневное резервное копирование с шифрованием
pg_dump smeta360_prod | gpg --symmetric --cipher-algo AES256 > backup_$(date +%Y%m%d).sql.gpg

# Тестирование восстановления (ежемесячно)
createdb test_restore
gpg --decrypt backup_20250928.sql.gpg | psql test_restore
dropdb test_restore
```

---

## ⚡ Немедленные действия (выполнить прямо сейчас)

### 1. Смените JWT секрет

```bash
# Сгенерируйте новый секрет
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Обновите .env файл
echo "JWT_SECRET=новый_сгенерированный_секрет" >> server/.env

# Перезапустите приложение
pm2 restart smeta360-api
```

### 2. Ограничьте доступ к базе данных

```sql
-- Подключитесь к PostgreSQL как superuser
-- Ограничьте права пользователя приложения

REVOKE ALL ON SCHEMA information_schema FROM smeta360;
REVOKE ALL ON SCHEMA pg_catalog FROM smeta360;

-- Дайте только необходимые права
GRANT CONNECT ON DATABASE smeta360_prod TO smeta360;
GRANT USAGE ON SCHEMA public TO smeta360;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO smeta360;
```

### 3. Включите логирование подозрительной активности

```bash
# Добавьте в конец server/index.js
console.log('🔐 Security logging enabled');
console.log('📊 Rate limiting enabled');  
console.log('🛡️ Input validation enabled');
```

---

## 🔍 Контрольный список безопасности

- [ ] **Критическое:** SQL injection исправлен
- [ ] **Критическое:** Пароли хешируются с bcrypt
- [ ] **Критическое:** Rate limiting добавлен
- [ ] **Критическое:** JWT секрет изменен на безопасный
- [ ] **Высокое:** Input validation добавлена
- [ ] **Высокое:** HTTPS принудительно используется
- [ ] **Высокое:** Security headers добавлены
- [ ] **Среднее:** Security логирование включено
- [ ] **Среднее:** Content Security Policy настроена
- [ ] **Низкое:** Зависимости обновлены
- [ ] **Низкое:** Backup система настроена

---

**⚠️ ВНИМАНИЕ**: Этот проект имеет серьезные проблемы с безопасностью. НЕ РАЗВЕРТЫВАЙТЕ В PRODUCTION без исправления всех критических и высоких рисков.

*Отчет по безопасности создан: 28 сентября 2025*  
*Security Audit Version: 1.0*