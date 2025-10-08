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
    base: '/',
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
      'process.env': 'import.meta.env',
      // Polyfill для React 18 совместимости
      'React.AsyncMode': 'React.Fragment',
      'React.unstable_AsyncMode': 'React.Fragment'
    },
    resolve: {
      alias: {
        '@ant-design/icons': path.resolve(__dirname, 'node_modules/@ant-design/icons'),
        // Фиксим React для правильного импорта
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
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
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      assetsInlineLimit: 0, // Отключаем инлайн ассетов - исправляет data: URLs
      rollupOptions: {
        external: (id) => {
          // Не делаем React external - он должен быть в bundle
          return false;
        },
        output: {
          format: 'es',
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM'
          },
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || '';
            const ext = name.split('.').pop();
            if (/\.css$/.test(name)) return `css/[name]-[hash].${ext}`;
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) return `images/[name]-[hash].${ext}`;
            if (/\.(woff2?|eot|ttf|otf)$/.test(name)) return `fonts/[name]-[hash].${ext}`;
            return `assets/[name]-[hash].${ext}`;
          },
          // T4-RECOVERY: Исправленное разделение на чанки - React первым
          manualChunks: (id) => {
            // Vendor chunk - основные библиотеки
            if (id.includes('node_modules')) {
              // React и React-DOM - самый важный чанк, загружается первым
              if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime')) {
                return 'vendor-react';
              }
              // Иконки ВМЕСТЕ с React - избегаем проблем с createContext
              if (id.includes('@ant-design/icons')) {
                return 'vendor-react';
              }
              // React Query
              if (id.includes('@tanstack/react-query')) {
                return 'vendor-query';
              }
              // Ant Design без иконок
              if (id.includes('antd')) {
                return 'vendor-antd';
              }
              // Material UI
              if (id.includes('@mui')) {
                return 'vendor-mui';
              }
              // Утилиты
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
        'react-dom/client',
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
