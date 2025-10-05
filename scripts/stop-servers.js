#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🛑 Остановка серверов SMETA360...');

try {
  // Остановка процессов на портах 3000 и 3001
  execSync('lsof -ti :3000,3001 | xargs -r kill -9', { stdio: 'ignore' });
  console.log('  ✅ Процессы на портах 3000,3001 остановлены');
} catch {
  console.log('  ℹ️  Порты 3000,3001 уже свободны');
}

try {
  // Остановка Node.js серверов проекта
  execSync('pkill -f "node.*server.*index.js"', { stdio: 'ignore' });
  console.log('  ✅ Backend серверы остановлены');
} catch {
  console.log('  ℹ️  Backend серверы не запущены');
}

try {
  // Остановка Vite процессов
  execSync('pkill -f "vite"', { stdio: 'ignore' });
  console.log('  ✅ Frontend серверы остановлены');
} catch {
  console.log('  ℹ️  Frontend серверы не запущены');
}

try {
  // Остановка concurrently процессов
  execSync('pkill -f "concurrently"', { stdio: 'ignore' });
  console.log('  ✅ Concurrently процессы остановлены');
} catch {
  console.log('  ℹ️  Concurrently процессы не запущены');
}

console.log('✅ Все серверы остановлены!');
console.log('');
