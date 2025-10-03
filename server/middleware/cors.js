/**
 * CORS Middleware Configuration
 * Настройка Cross-Origin Resource Sharing
 */
import cors from 'cors';

// Конфигурация CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) return callback(null, true);
    
    // Список разрешенных доменов
    const allowedOrigins = [
      'http://localhost:3000',      // Frontend dev server
      'http://localhost:5173',      // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      // Добавьте production домены здесь
    ];
    
    // Проверяем, есть ли origin в списке разрешенных
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS: Запрос с неразрешенного домена: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Разрешаем cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Middleware для CORS
export const corsMiddleware = cors(corsOptions);

// Альтернативная конфигурация для разработки (более мягкая)
export const corsDevMiddleware = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*']
});

export default corsMiddleware;
