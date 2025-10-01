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
      proxy: {
        '/api-proxy': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, '/api'),
          secure: false
        }
      }
    },
    preview: {
      open: true,
      host: true
    },
    define: {
      global: 'window'
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
          // Разделение на чанки для оптимизации загрузки
          manualChunks: (id) => {
            // MUI библиотеки в отдельные чанки
            if (id.includes('@mui/material')) return 'mui-core';
            if (id.includes('@mui/icons-material')) return 'mui-icons';
            
            // Ant Design в отдельные чанки
            if (id.includes('antd') && !id.includes('@ant-design/icons')) return 'antd-core';
            if (id.includes('@ant-design/icons')) return 'antd-icons';
            
            // React экосистема
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            
            // Чарты (если они установлены)
            if (id.includes('apexcharts') || id.includes('react-apexcharts')) {
              return 'charts';
            }
            
            // React Query
            if (id.includes('@tanstack/react-query')) return 'react-query';
            
            // Vendor библиотеки в node_modules
            if (id.includes('node_modules')) return 'vendor';
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
      include: [
        'react',
        'react-dom', 
        'react-router-dom',
        '@mui/material',
        '@mui/material/Tooltip',
        '@mui/material/Button',
        '@mui/material/Typography',
        '@mui/material/Grid',
        '@mui/material/Box',
        '@mui/material/Stack',
        'antd',
        '@ant-design/icons'
      ]
    }
  };
});
