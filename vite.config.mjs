import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = env.VITE_APP_BASE_NAME || '/';
  const PORT = 3000;

  return {
    base: API_URL,
    server: {
      open: true,
      port: PORT,
      host: true,
      // T4-RECOVERY: Оптимизация dev сервера
      hmr: {
        overlay: false // Отключаем overlay для лучшей производительности
      },
      fs: {
        strict: false // Разрешаем доступ к файлам вне root
      },
      // Исправляем MIME типы для JSX
      middlewareMode: false,
      cors: true,
      proxy: {
        '/api-proxy': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
          secure: false,
          // Оптимизация прокси
          timeout: 30000,
          proxyTimeout: 30000
        }
      }
    },
    preview: {
      open: true,
      host: true
    },
    define: {
      global: 'window',
      // Исправляем проблемы с process в браузере
      'process.env': 'import.meta.env'
    },
    resolve: {
      alias: {
        '@ant-design/icons': path.resolve(__dirname, 'node_modules/@ant-design/icons')
        // Add more aliases as needed
      }
    },
    plugins: [
      react(),
      jsconfigPaths(),
      // Bundle analyzer - создает stats.html для анализа размера бандла
      visualizer({
        filename: 'dist/stats.html',
        open: false, // не открываем автоматически в headless окружении
        gzipSize: true,
        brotliSize: true
      })
    ],
    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: false, // Отключаем source maps для production
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || '';
            const ext = name.split('.').pop();
            if (/\.css$/.test(name)) return `css/[name]-[hash].${ext}`;
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) return `images/[name]-[hash].${ext}`;
            if (/\.(woff2?|eot|ttf|otf)$/.test(name)) return `fonts/[name]-[hash].${ext}`;
            return `assets/[name]-[hash].${ext}`;
          },
          // T4-RECOVERY: Оптимизированное разделение на чанки
          manualChunks: (id) => {
            // Vendor chunk - основные библиотеки
            if (id.includes('node_modules')) {
              // React + иконки + hoist-non-react-statics должны быть вместе
              if (id.includes('react') || id.includes('react-dom') || id.includes('@ant-design/icons') || id.includes('hoist-non-react-statics')) {
                return 'vendor-react';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'vendor-query';
              }
              if (id.includes('antd') && !id.includes('@ant-design/icons')) {
                return 'vendor-antd';
              }
              if (id.includes('@mui')) {
                return 'vendor-mui';
              }
              if (id.includes('axios') || id.includes('lodash')) {
                return 'vendor-utils';
              }
              // Остальные vendor libraries
              return 'vendor-misc';
            }
          }
        }
      },
      // Минификация и оптимизация
      minify: 'esbuild',
      // Only drop console/debugger in production
      ...(mode === 'production' && {
        esbuild: {
          drop: ['console', 'debugger'],
          pure: ['console.log', 'console.info', 'console.debug', 'console.warn']
        }
      })
    },
    optimizeDeps: {
      // Явно предбандлим «тяжёлых» - решение проблемы 329 JS модулей
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@tanstack/react-query',
        'antd/es/button',
        'antd/es/input',
        'antd/es/table',
        'antd/es/layout',
        'antd/es/menu',
        'antd/es/card',
        'antd/es/form',
        'antd/es/select',
        '@ant-design/icons',
        '@mui/material',
        '@mui/material/Box',
        '@mui/material/Button',
        '@mui/icons-material',
        'hoist-non-react-statics',
        '@emotion/react',
        '@emotion/styled',
        'axios',
        'react-router-dom'
      ],
      // Заставляем Vite предкомпилировать проблемные ESM пакеты
      force: true
    },
    // Настройка для правильной обработки CommonJS модулей
    esbuild: {
      // Исправляем проблемы с default экспортами
      ...(mode !== 'production' && {
        keepNames: true
      })
    },
    // Дополнительная конфигурация для resolve
    ssr: {
      noExternal: ['hoist-non-react-statics']
    }
  };
});
