import client from 'prom-client';

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table', 'operation']
});

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

export function observeRequestDuration(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { 
      method: req.method, 
      route: req.route?.path || req.path, 
      status_code: res.statusCode 
    };
    end(labels);
    httpRequestCounter.inc(labels);
  });
  next();
}

export function observeDbQuery(queryText, duration) {
  const operation = queryText.trim().split(' ')[0].toLowerCase();
  let table = 'unknown';
  
  // Простое извлечение таблицы из запроса
  const tableMatch = queryText.match(/(?:FROM|INTO|UPDATE|TABLE)\s+(\w+)/i);
  if (tableMatch) {
    table = tableMatch[1];
  }
  
  dbQueryDuration.observe({ 
    query_type: operation, 
    table: table, 
    operation: operation 
  }, duration / 1000); // конвертируем ms в секунды
}

export async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error('❌ Ошибка генерации метрик:', error);
    res.status(500).send('Ошибка генерации метрик');
  }
}