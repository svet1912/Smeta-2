#!/usr/bin/env node

/**
 * Скрипт для запуска E2E тестов с автоматическим управлением frontend приложением
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import fetch from 'node-fetch';

const FRONTEND_URL = 'http://localhost:4174';
const FRONTEND_PORT = 4174;
const APP_START_TIMEOUT = 60000; // 60 секунд
const APP_CHECK_INTERVAL = 2000; // 2 секунды

let frontendProcess = null;
let testProcess = null;

// Функция для проверки готовности frontend приложения
async function waitForFrontend() {
  console.log('⏳ Ожидание готовности frontend приложения...');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < APP_START_TIMEOUT) {
    try {
      const response = await fetch(FRONTEND_URL, { timeout: 3000 });
      if (response.ok) {
        console.log('✅ Frontend приложение готово');
        return true;
      }
    } catch (error) {
      // Игнорируем ошибки и продолжаем ждать
    }
    
    await setTimeout(APP_CHECK_INTERVAL);
  }
  
  throw new Error(`Frontend приложение не готово через ${APP_START_TIMEOUT}ms`);
}

// Функция для остановки процессов
async function cleanup() {
  console.log('🧹 Очистка процессов...');
  
  if (testProcess) {
    testProcess.kill('SIGTERM');
    testProcess = null;
  }
  
  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
    frontendProcess = null;
  }
  
  // Принудительная очистка портов
  try {
    const { spawn: syncSpawn } = await import('child_process');
    syncSpawn('lsof', [`-ti:${FRONTEND_PORT}`], { stdio: 'pipe' })
      .stdout.on('data', (data) => {
        const pids = data.toString().trim().split('\n');
        pids.forEach(pid => {
          if (pid) {
            try {
              process.kill(parseInt(pid), 'SIGKILL');
              console.log(`🔪 Убит процесс ${pid} на порту ${FRONTEND_PORT}`);
            } catch (err) {
              // Игнорируем ошибки
            }
          }
        });
      });
  } catch (err) {
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
    console.log('🚀 Запуск E2E тестов с frontend приложением...');
    
    // 1. Очистка портов
    await cleanup();
    await setTimeout(2000);
    
    // 2. Сборка приложения
    console.log('🔨 Сборка frontend приложения...');
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    const buildExitCode = await new Promise((resolve) => {
      buildProcess.on('close', resolve);
    });
    
    if (buildExitCode !== 0) {
      throw new Error(`Сборка завершилась с кодом: ${buildExitCode}`);
    }
    
    console.log('✅ Сборка завершена успешно');
    
    // 3. Запуск preview сервера
    console.log('🌐 Запуск preview сервера...');
    frontendProcess = spawn('npx', ['vite', 'preview', '--port', FRONTEND_PORT.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('preview')) {
        console.log('📡 Preview сервер:', output.trim());
      }
    });
    
    frontendProcess.stderr.on('data', (data) => {
      console.error('❌ Ошибка preview сервера:', data.toString().trim());
    });
    
    // 4. Ожидание готовности приложения
    await waitForFrontend();
    
    // 5. Запуск E2E тестов
    console.log('🧪 Запуск E2E тестов...');
    testProcess = spawn('npx', ['playwright', 'test'], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    // 6. Ожидание завершения тестов
    const testExitCode = await new Promise((resolve) => {
      testProcess.on('close', resolve);
    });
    
    console.log(`📊 E2E тесты завершены с кодом: ${testExitCode}`);
    
    // 7. Очистка
    await cleanup();
    
    process.exit(testExitCode);
    
  } catch (error) {
    console.error('💥 Ошибка при выполнении E2E тестов:', error.message);
    await cleanup();
    process.exit(1);
  }
}

main();