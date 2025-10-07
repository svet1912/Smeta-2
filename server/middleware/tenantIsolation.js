import jwt from 'jsonwebtoken';

// Middleware для tenant изоляции
const tenantIsolation = async (req, res, next) => {
  try {
    // Пропускаем для health check и тестовых эндпоинтов
    if (req.path === '/api/health' || req.path === '/api/test' || req.path.startsWith('/api/health/')) {
      return next();
    }

    // Извлекаем JWT токен из заголовка Authorization
    const authHeader = req.headers.authorization;
    let userId = null;
    let tenantId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.decode(token); // Декодируем без проверки для получения данных
        userId = decoded?.userId;
        tenantId = decoded?.tenantId; // Берем tenantId прямо из JWT
        console.log(`🔍 Извлечен userId ${userId}, tenantId ${tenantId} из JWT токена`);
      } catch (jwtError) {
        console.log(`⚠️ Ошибка декодирования JWT токена: ${jwtError.message}`);
      }
    }
    
    if (tenantId && req.db) {
      try {
        // Устанавливаем tenant контекст напрямую, используя tenantId из JWT
        await req.db.query('SELECT set_tenant_context($1)', [tenantId]);
        
        req.tenantId = tenantId;
        console.log(`🏢 Tenant контекст установлен: ${tenantId} для пользователя ${userId}`);
      } catch (dbError) {
        console.log(`⚠️ Ошибка установки tenant контекста: ${dbError.message}`);
        // Продолжаем без tenant изоляции
      }
    } else if (authHeader && !tenantId) {
      console.log(`⚠️ tenantId не найден в JWT токене`);
    } else if (authHeader) {
      console.log(`⚠️ Не удалось извлечь userId из Authorization заголовка`);
    }

    next();
  } catch (error) {
    console.error('❌ Ошибка в tenant middleware:', error);
    next(); // Продолжаем выполнение, не блокируем запросы
  }
};

export { tenantIsolation };