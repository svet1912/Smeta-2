# 🚀 Руководство по развертыванию SMETA360

> Пошаговое руководство для развертывания системы SMETA360 в различных окружениях

---

## 📋 Содержание

1. [Требования к системе](#требования-к-системе)
2. [Development окружение](#development-окружение)
3. [Production развертывание](#production-развертывание)
4. [Docker развертывание](#docker-развертывание)
5. [Конфигурация базы данных](#конфигурация-базы-данных)
6. [Мониторинг и логирование](#мониторинг-и-логирование)
7. [Резервное копирование](#резервное-копирование)
8. [Troubleshooting](#troubleshooting)

---

## 💻 Требования к системе

### Минимальные требования

#### Development

```
CPU:     2 cores
RAM:     4 GB
Disk:    10 GB SSD
OS:      Windows 10/11, macOS 10.15+, Ubuntu 18.04+
Node.js: 18.0.0+
PostgreSQL: 12.0+
```

#### Production

```
CPU:     4+ cores
RAM:     8+ GB  
Disk:    50+ GB SSD
OS:      Ubuntu 20.04+ LTS, CentOS 8+, Debian 11+
Node.js: 18.0.0+ LTS
PostgreSQL: 14.0+
Nginx:   1.18+
```

### Рекомендуемые характеристики

#### Production (средняя нагрузка)

```
CPU:     8+ cores (Intel Xeon или AMD EPYC)
RAM:     16+ GB
Disk:    100+ GB NVMe SSD
Network: 1 Gbit/s
Load Balancer: Nginx или HAProxy
Database: PostgreSQL 15+ с репликацией
```

---

## ⚙️ Development окружение

### Быстрый старт

#### Windows

```powershell
# 1. Установка Node.js 18+
winget install OpenJS.NodeJS

# 2. Установка PostgreSQL
winget install PostgreSQL.PostgreSQL

# 3. Клонирование проекта
git clone https://github.com/username/smeta360.git
cd smeta360

# 4. Установка зависимостей
npm install --legacy-peer-deps
cd server
npm install

# 5. Настройка базы данных
createdb smeta360_dev
psql smeta360_dev -f create_works_ref_database.sql

# 6. Настройка переменных окружения
Copy-Item server\.env.example server\.env
# Отредактируйте server/.env файл

# 7. Запуск development серверов
npm run dev
```

#### Linux/macOS

```bash
# 1. Установка Node.js 18+ (через nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 2. Установка PostgreSQL
# Ubuntu/Debian:
sudo apt update && sudo apt install postgresql postgresql-contrib
# macOS:
brew install postgresql

# 3. Клонирование проекта
git clone https://github.com/username/smeta360.git
cd smeta360

# 4. Установка зависимостей
npm install --legacy-peer-deps
cd server && npm install

# 5. Настройка базы данных
sudo -u postgres createdb smeta360_dev
sudo -u postgres psql smeta360_dev -f create_works_ref_database.sql

# 6. Настройка переменных окружения
cp server/.env.example server/.env
nano server/.env

# 7. Запуск development серверов
npm run dev
```

### Development конфигурация

#### `server/.env` (development)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/smeta360_dev

# Authentication
JWT_SECRET=dev-secret-key-change-in-production
BCRYPT_SALT_ROUNDS=10

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Debugging
DEBUG=smeta360:*
LOG_LEVEL=debug
```

#### Структура портов (development)

```
Frontend (Vite):    http://localhost:3000
Backend (Express):  http://localhost:3001
Database:          postgresql://localhost:5432
```

---

## 🏭 Production развертывание

### Подготовка сервера

#### Ubuntu 20.04+ LTS

```bash
# 1. Обновление системы
sudo apt update && sudo apt upgrade -y

# 2. Установка базовых пакетов
sudo apt install -y curl wget git build-essential

# 3. Установка Node.js 18+ LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Установка PostgreSQL 15
sudo apt install -y postgresql-15 postgresql-contrib-15

# 5. Установка Nginx
sudo apt install -y nginx

# 6. Установка PM2 для управления процессами
sudo npm install -g pm2

# 7. Настройка firewall
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw --force enable
```

### Клонирование и настройка проекта

```bash
# 1. Создание пользователя для приложения
sudo useradd -m -s /bin/bash smeta360
sudo usermod -aG sudo smeta360

# 2. Переключение на пользователя приложения
sudo su - smeta360

# 3. Клонирование проекта
git clone https://github.com/username/smeta360.git /home/smeta360/smeta360
cd /home/smeta360/smeta360

# 4. Установка зависимостей
npm ci --only=production --legacy-peer-deps
cd server && npm ci --only=production

# 5. Сборка frontend
cd ..
npm run build
```

### Настройка базы данных

```bash
# 1. Создание пользователя PostgreSQL
sudo -u postgres createuser --interactive smeta360
# Выберите: n, n, n, y (no superuser, no createdb, no createrole, yes login)

# 2. Создание базы данных
sudo -u postgres createdb smeta360_prod -O smeta360

# 3. Установка пароля
sudo -u postgres psql -c "ALTER USER smeta360 PASSWORD 'secure_production_password';"

# 4. Импорт схемы
sudo -u postgres psql smeta360_prod -f /home/smeta360/smeta360/create_works_ref_database.sql

# 5. Настройка PostgreSQL для production
sudo nano /etc/postgresql/15/main/postgresql.conf
```

#### PostgreSQL production настройки

```conf
# /etc/postgresql/15/main/postgresql.conf

# Connection Settings
listen_addresses = 'localhost'
port = 5432
max_connections = 100

# Memory Settings  
shared_buffers = 256MB          # 25% of RAM для dedicated server
effective_cache_size = 1GB      # 75% of RAM
work_mem = 4MB
maintenance_work_mem = 64MB

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_min_duration_statement = 1000

# Security
ssl = on
password_encryption = scram-sha-256
```

```conf
# /etc/postgresql/15/main/pg_hba.conf

# Local connections
local   all             postgres                                peer
local   all             smeta360                                scram-sha-256

# IPv4 local connections
host    smeta360_prod   smeta360        127.0.0.1/32            scram-sha-256
```

### Production environment переменные

```bash
# Создание production .env файла
sudo nano /home/smeta360/smeta360/server/.env
```

```env
# Database
DATABASE_URL=postgresql://smeta360:secure_production_password@localhost:5432/smeta360_prod

# Authentication (ОБЯЗАТЕЛЬНО СМЕНИТЕ!)
JWT_SECRET=super-secure-256-bit-production-secret-key-here
BCRYPT_SALT_ROUNDS=12

# Server
PORT=3001
NODE_ENV=production

# Security
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # 100 requests per window

# Logging
LOG_LEVEL=info
LOG_DIRECTORY=/home/smeta360/smeta360/logs

# Session
SESSION_TIMEOUT=3600           # 1 hour
REFRESH_TOKEN_EXPIRY=2592000   # 30 days
```

### Nginx конфигурация

```bash
sudo nano /etc/nginx/sites-available/smeta360
```

```nginx
# /etc/nginx/sites-available/smeta360

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Static Files
    location / {
        root /home/smeta360/smeta360/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # File Upload Size
    client_max_body_size 10M;
    
    # Logs
    access_log /var/log/nginx/smeta360_access.log;
    error_log /var/log/nginx/smeta360_error.log;
}
```

```bash
# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/smeta360 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL сертификат (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автообновление сертификата
sudo crontab -e
# Добавить строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### PM2 конфигурация

```bash
# Создание PM2 ecosystem файла
nano /home/smeta360/smeta360/ecosystem.config.js
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smeta360-api',
    script: 'server/index.js',
    cwd: '/home/smeta360/smeta360',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/home/smeta360/smeta360/logs/pm2-error.log',
    out_file: '/home/smeta360/smeta360/logs/pm2-out.log',
    log_file: '/home/smeta360/smeta360/logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024',
    
    // Мониторинг
    min_uptime: '10s',
    max_restarts: 10,
    
    // Graceful restart
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Автозапуск
    autorestart: true,
    watch: false
  }]
};
```

```bash
# Создание директории для логов
mkdir -p /home/smeta360/smeta360/logs

# Запуск приложения
cd /home/smeta360/smeta360
pm2 start ecosystem.config.js

# Автозапуск при перезагрузке системы
pm2 save
pm2 startup
# Выполните команду, которую покажет PM2

# Проверка статуса
pm2 status
pm2 logs smeta360-api
```

---

## 🐳 Docker развертывание

### Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

# Установка зависимостей для сборки
RUN apk add --no-cache python3 make g++

# Рабочая директория
WORKDIR /app

# Копирование package файлов
COPY package*.json ./
COPY server/package*.json ./server/

# Установка зависимостей
RUN npm ci --legacy-peer-deps
RUN cd server && npm ci --only=production

# Копирование исходного кода
COPY . .

# Сборка frontend
RUN npm run build

# Production образ
FROM node:18-alpine

# Создание пользователя
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Рабочая директория
WORKDIR /app

# Копирование собранного приложения
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server/node_modules ./server/node_modules

# Настройка прав
RUN chown -R nodejs:nodejs /app
USER nodejs

# Порт
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node server/healthcheck.js

# Запуск
CMD ["node", "server/index.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://smeta360:${DB_PASSWORD}@db:5432/smeta360_prod
      - JWT_SECRET=${JWT_SECRET}
      - BCRYPT_SALT_ROUNDS=12
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    networks:
      - smeta360-network

  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=smeta360_prod
      - POSTGRES_USER=smeta360
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./create_works_ref_database.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U smeta360 -d smeta360_prod"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - smeta360-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - smeta360-network

volumes:
  postgres_data:

networks:
  smeta360-network:
    driver: bridge
```

### .env для Docker

```env
# .env
DB_PASSWORD=secure_production_password_here
JWT_SECRET=super-secure-256-bit-production-secret-key-here
```

### Развертывание с Docker

```bash
# 1. Клонирование проекта
git clone https://github.com/username/smeta360.git
cd smeta360

# 2. Создание .env файла
cp .env.example .env
nano .env

# 3. Сборка и запуск
docker-compose build
docker-compose up -d

# 4. Проверка статуса
docker-compose ps
docker-compose logs -f app

# 5. Остановка
docker-compose down

# 6. Перезапуск после обновления
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Мониторинг и логирование

### System monitoring

#### Node.js процесс мониторинг

```bash
# PM2 мониторинг
pm2 monit

# Метрики через PM2
pm2 show smeta360-api

# Web мониторинг (опционально)
pm2 install pm2-server-monit
```

#### System метрики

```bash
# Установка htop для мониторинга системы
sudo apt install htop

# Мониторинг дискового пространства
df -h

# Мониторинг памяти
free -h

# Мониторинг сетевых соединений
netstat -tulnp | grep :3001
```

### Логирование

#### Структурированные логи

```javascript
// server/utils/logger.js (для добавления)
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

#### Ротация логов

```bash
# Установка logrotate
sudo apt install logrotate

# Конфигурация logrotate
sudo nano /etc/logrotate.d/smeta360
```

```
# /etc/logrotate.d/smeta360
/home/smeta360/smeta360/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    create 0644 smeta360 smeta360
    postrotate
        pm2 reload smeta360-api
    endscript
}
```

### Health checks

```javascript
// server/healthcheck.js (для создания)
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

---

## 💾 Резервное копирование

### Автоматизированное резервное копирование PostgreSQL

```bash
# Создание скрипта резервного копирования
sudo nano /home/smeta360/backup.sh
```

```bash
#!/bin/bash
# backup.sh

# Конфигурация
DB_NAME="smeta360_prod"
DB_USER="smeta360"
BACKUP_DIR="/home/smeta360/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Создание директории
mkdir -p $BACKUP_DIR

# Создание резервной копии
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/smeta360_$DATE.sql.gz

# Проверка успешности
if [ $? -eq 0 ]; then
    echo "$(date): Backup successful - smeta360_$DATE.sql.gz" >> $BACKUP_DIR/backup.log
else
    echo "$(date): Backup failed" >> $BACKUP_DIR/backup.log
    exit 1
fi

# Удаление старых резервных копий
find $BACKUP_DIR -name "smeta360_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "$(date): Old backups cleaned" >> $BACKUP_DIR/backup.log
```

```bash
# Установка прав на выполнение
chmod +x /home/smeta360/backup.sh

# Настройка cron для автоматического резервного копирования
sudo crontab -u smeta360 -e
# Добавить строку для ежедневного резервного копирования в 2:00:
# 0 2 * * * /home/smeta360/backup.sh
```

### Резервное копирование файлов приложения

```bash
#!/bin/bash
# app-backup.sh

APP_DIR="/home/smeta360/smeta360"
BACKUP_DIR="/home/smeta360/app-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Создание архива (исключая node_modules и логи)
tar -czf $BACKUP_DIR/smeta360-app_$DATE.tar.gz \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    -C /home/smeta360 smeta360

echo "$(date): App backup created - smeta360-app_$DATE.tar.gz" >> $BACKUP_DIR/backup.log
```

### Восстановление из резервной копии

```bash
# Восстановление базы данных
gunzip -c /home/smeta360/backups/smeta360_20250928_020001.sql.gz | psql -U smeta360 -d smeta360_prod

# Восстановление приложения
cd /home/smeta360
tar -xzf app-backups/smeta360-app_20250928_020001.tar.gz
cd smeta360
npm ci --only=production
pm2 restart smeta360-api
```

---

## 🔧 Troubleshooting

### Типичные проблемы

#### Проблема: Приложение не запускается

```bash
# Проверка логов PM2
pm2 logs smeta360-api --lines 50

# Проверка переменных окружения
cat server/.env

# Проверка подключения к базе данных
psql -U smeta360 -d smeta360_prod -h localhost -c "SELECT 1;"

# Проверка прав на файлы
ls -la server/
```

#### Проблема: Высокая нагрузка на CPU/память

```bash
# Мониторинг процессов
pm2 monit

# Проверка запросов к базе данных
sudo -u postgres psql smeta360_prod -c "SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';"

# Проверка системной нагрузки
htop
iostat -x 1

# Перезапуск с ограничением памяти
pm2 restart smeta360-api --update-env
```

#### Проблема: Медленные запросы к базе данных

```sql
-- Включение логирования медленных запросов
-- В postgresql.conf:
-- log_min_duration_statement = 1000

-- Анализ медленных запросов
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Проверка индексов
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC;
```

#### Проблема: Ошибки Nginx

```bash
# Проверка конфигурации Nginx
sudo nginx -t

# Перезагрузка конфигурации
sudo nginx -s reload

# Проверка логов Nginx
sudo tail -f /var/log/nginx/smeta360_error.log

# Проверка доступности backend
curl -I http://127.0.0.1:3001/api/health
```

### Диагностические команды

```bash
# Общее состояние системы
systemctl status nginx postgresql pm2-smeta360

# Проверка портов
netstat -tulnp | grep -E ':(80|443|3001|5432)'

# Проверка дискового пространства
df -h

# Проверка памяти
free -h && sync && echo 3 > /proc/sys/vm/drop_caches && free -h

# Проверка подключений к базе данных
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Проверка SSL сертификата
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null 2>/dev/null | openssl x509 -text -noout | grep -A 2 "Validity"
```

### Performance tuning

#### PostgreSQL оптимизация

```sql
-- Анализ производительности
ANALYZE;

-- Переиндексация (при необходимости)
REINDEX DATABASE smeta360_prod;

-- Очистка статистики
SELECT pg_stat_reset();

-- Проверка размера таблиц
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Node.js оптимизация

```javascript
// ecosystem.config.js - производительность
module.exports = {
  apps: [{
    name: 'smeta360-api',
    script: 'server/index.js',
    instances: 'max',  // Используем все CPU cores
    exec_mode: 'cluster',
    node_args: [
      '--max-old-space-size=1024',  // Ограничение памяти
      '--optimize-for-size'         // Оптимизация для размера
    ],
    env: {
      UV_THREADPOOL_SIZE: 16        // Увеличиваем thread pool
    }
  }]
};
```

---

## 📈 Мониторинг производительности

### Ключевые метрики

#### Application метрики

```bash
# PM2 метрики
pm2 show smeta360-api

# CPU и память
ps aux | grep node

# Количество запросов (через логи Nginx)
tail -f /var/log/nginx/smeta360_access.log | grep -o "POST\|GET\|PUT\|DELETE" | sort | uniq -c
```

#### Database метрики

```sql
-- Активные соединения
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Статистика по таблицам
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;

-- Статистика запросов (требует pg_stat_statements)
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

### Уведомления об ошибках

```bash
# Простой мониторинг через cron
*/5 * * * * /home/smeta360/check-health.sh
```

```bash
#!/bin/bash
# check-health.sh

# Проверка API
if ! curl -f -s http://localhost:3001/api/health > /dev/null; then
    echo "$(date): SMETA360 API is down!" | mail -s "ALERT: SMETA360 API Down" admin@example.com
fi

# Проверка базы данных
if ! pg_isready -U smeta360 -d smeta360_prod > /dev/null; then
    echo "$(date): PostgreSQL is down!" | mail -s "ALERT: Database Down" admin@example.com
fi

# Проверка дискового пространства
USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $USAGE -gt 85 ]; then
    echo "$(date): Disk usage is at $USAGE%!" | mail -s "ALERT: High Disk Usage" admin@example.com
fi
```

---

*Руководство по развертыванию обновлено: 28 сентября 2025*  
*Версия: 1.0*