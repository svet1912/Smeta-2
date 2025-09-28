#!/usr/bin/env bash
set -euo pipefail

# Проверим наличие секретов
: "${DB_URL:?Missing DB_URL Codespaces secret}"

# Backend .env
mkdir -p server src
cat > server/.env <<EOF
NODE_ENV=development
PORT=3001
DATABASE_URL=${DB_URL}
# Для Aiven достаточно sslmode=require в URL, NODE_TLS_REJECT_UNAUTHORIZED не нужен
PGSSLMODE=require
EOF

# Frontend .env.local (публичные переменные только через префикс VITE_)
cat > src/.env.local <<EOF
VITE_API_BASE_URL=${API_BASE_URL:-http://localhost:3001/api}
EOF

echo "✅ Созданы server/.env и src/.env.local"
