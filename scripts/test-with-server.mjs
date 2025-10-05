#!/usr/bin/env node

/**
 * Скрипт для запуска backend тестов с автоматическим управлением сервером
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/health';
const SERVER_START_TIMEOUT = 30000; // 30 секунд
const SERVER_CHECK_INTERVAL = 1000; // 1 секунда

let serverProcess = null;
let testProcess = null;

// Функция для проверки готовности сервера
async function waitForServer() {
  console.log('⏳ Ожидание готовности сервера...');

  const startTime = Date.now();

  while (Date.now() - startTime < SERVER_START_TIMEOUT) {
    try {
      const response = await fetch(API_URL, { timeout: 3000 });
      if (response.ok) {
        console.log('✅ Сервер готов');
        return true;
      }
    } catch {
      // Игнорируем ошибки и продолжаем ждать
    }

    await setTimeout(SERVER_CHECK_INTERVAL);
  }

  throw new Error(`Сервер не готов через ${SERVER_START_TIMEOUT}ms`);
}

// Функция для остановки процессов
async function cleanup() {
  console.log('🧹 Очистка процессов...');

  if (testProcess) {
    testProcess.kill('SIGTERM');
    testProcess = null;
  }

  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }

  // Принудительная очистка портов
  try {
    const { spawn: syncSpawn } = await import('child_process');
    syncSpawn('lsof', ['-ti:3001'], { stdio: 'pipe' }).stdout.on('data', (data) => {
      const pids = data.toString().trim().split('\n');
      pids.forEach((pid) => {
        if (pid) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
            console.log(`🔪 Убит процесс ${pid} на порту 3001`);
          } catch {
            // Игнорируем ошибки
          }
        }
      });
    });
  } catch {
    // Игнорируем ошибки
  }
}

// Обработчики сигналов для корректной очистки
process.on('SIGINT', async () => {
  console.log('\n🛑 Получен сигнал прерывания...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Получен сигнал завершения...');
  await cleanup();
  process.exit(0);
});

async function main() {
  try {
    console.log('🚀 Запуск backend тестов с сервером...');

    // 1. Очистка портов
    await cleanup();
    await setTimeout(2000);

    // 2. Запуск сервера
    console.log('🌐 Запуск backend сервера...');
    serverProcess = spawn('npm', ['run', 'server'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running') || output.includes('🚀')) {
        console.log('📡 Сервер:', output.trim());
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('❌ Ошибка сервера:', data.toString().trim());
    });

    // 3. Ожидание готовности сервера
    await waitForServer();

    // 4. Запуск тестов
    console.log('🧪 Запуск backend тестов...');
    testProcess = spawn('vitest', ['run', '--config', 'vitest.config.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // 5. Ожидание завершения тестов
    const testExitCode = await new Promise((resolve) => {
      testProcess.on('close', resolve);
    });

    console.log(`📊 Тесты завершены с кодом: ${testExitCode}`);

    // 6. Очистка
    await cleanup();

    process.exit(testExitCode);
  } catch (error) {
    console.error('💥 Ошибка при выполнении тестов:', error.message);
    await cleanup();
    process.exit(1);
  }
}

main();
