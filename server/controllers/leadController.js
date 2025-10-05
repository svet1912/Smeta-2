import { query } from '../database.js';
import rateLimit from 'express-rate-limit';

// Rate limiting специально для лид-формы
export const leadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // Максимум 3 заявки с одного IP в час
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Превышен лимит отправки заявок. Попробуйте через час.',
    retryAfter: 3600
  },
  skip: (req) => {
    // Пропускаем ограничение для локальной разработки
    return req.ip === '::1' || req.ip === '127.0.0.1';
  }
});

// Валидация полей формы
const validateLeadData = (data) => {
  const errors = [];

  // Обязательные поля
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Имя должно содержать минимум 2 символа');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Введите корректный email адрес');
  }

  if (!data.consent) {
    errors.push('Необходимо согласие на обработку персональных данных');
  }

  // Проверка длины полей
  if (data.name && data.name.length > 100) {
    errors.push('Имя слишком длинное (максимум 100 символов)');
  }

  if (data.email && data.email.length > 254) {
    errors.push('Email слишком длинный');
  }

  if (data.phone && data.phone.length > 20) {
    errors.push('Телефон слишком длинный (максимум 20 символов)');
  }

  if (data.company && data.company.length > 200) {
    errors.push('Название компании слишком длинное (максимум 200 символов)');
  }

  if (data.message && data.message.length > 1000) {
    errors.push('Сообщение слишком длинное (максимум 1000 символов)');
  }

  // Проверка на ханипот (скрытое поле)
  if (data.website) {
    errors.push('Обнаружена подозрительная активность');
  }

  return errors;
};

// Функция отправки уведомления в Telegram
const sendTelegramNotification = async (leadData) => {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('📢 Telegram уведомления не настроены - пропускаем');
    return;
  }

  try {
    const envLabel = process.env.ENV_NAME || 'unknown';
    const message = `🚀 Новая заявка с лендинга SMETA360 [${envLabel}]

👤 Имя: ${leadData.name}
📧 Email: ${leadData.email}
${leadData.phone ? `📱 Телефон: ${leadData.phone}` : ''}
${leadData.company ? `🏢 Компания: ${leadData.company}` : ''}
${leadData.project_type ? `🏗️ Тип проекта: ${leadData.project_type}` : ''}
${leadData.budget ? `💰 Бюджет: ${leadData.budget}` : ''}
${leadData.message ? `💬 Сообщение: ${leadData.message}` : ''}

🔗 Источник: ${leadData.page_path || '/'}
📊 UTM: ${leadData.utm_source || 'direct'} / ${leadData.utm_medium || 'none'} / ${leadData.utm_campaign || 'none'}
⏰ Время: ${new Date(leadData.created_at).toLocaleString('ru-RU')}`;

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (response.ok) {
      console.log('✅ Уведомление в Telegram отправлено');
    } else {
      console.error('❌ Ошибка отправки в Telegram:', await response.text());
    }
  } catch (error) {
    console.error('❌ Ошибка Telegram API:', error.message);
  }
};

// Создание таблицы для заявок
export const initializeLeadsTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(254) NOT NULL,
        phone VARCHAR(20),
        company VARCHAR(200),
        project_type VARCHAR(50),
        budget VARCHAR(100),
        message TEXT,
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100), 
        utm_campaign VARCHAR(100),
        page_path VARCHAR(500),
        env_name VARCHAR(20),
        ip_address INET,
        user_agent TEXT,
        consent BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Индекс для быстрого поиска по email и времени
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_email_created 
      ON leads (email, created_at DESC)
    `);

    console.log('✅ Таблица leads инициализирована');
  } catch (error) {
    console.error('❌ Ошибка создания таблицы leads:', error);
  }
};

// Основной обработчик создания заявки
export const createLead = async (req, res) => {
  try {
    const leadData = {
      name: req.body.name?.trim(),
      email: req.body.email?.trim().toLowerCase(),
      phone: req.body.phone?.trim(),
      company: req.body.company?.trim(),
      project_type: req.body.project_type,
      budget: req.body.budget,
      message: req.body.message?.trim(),
      utm_source: req.body.utm_source,
      utm_medium: req.body.utm_medium,
      utm_campaign: req.body.utm_campaign,
      page_path: req.body.page_path,
      env_name: process.env.ENV_NAME || 'unknown',
      consent: req.body.consent,
      website: req.body.website // ханипот поле
    };

    // Валидация данных
    const validationErrors = validateLeadData(leadData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Ошибка валидации данных',
        details: validationErrors
      });
    }

    // Проверка на дублирование (тот же email в последние 10 минут)
    const recentLead = await query(
      `
      SELECT id FROM leads 
      WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `,
      [leadData.email]
    );

    if (recentLead.rows.length > 0) {
      return res.status(429).json({
        error: 'Заявка с этого email уже была отправлена недавно'
      });
    }

    // Сохранение в базу данных
    const result = await query(
      `
      INSERT INTO leads (
        name, email, phone, company, project_type, budget, message,
        utm_source, utm_medium, utm_campaign, page_path, env_name,
        ip_address, user_agent, consent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, created_at
    `,
      [
        leadData.name,
        leadData.email,
        leadData.phone,
        leadData.company,
        leadData.project_type,
        leadData.budget,
        leadData.message,
        leadData.utm_source,
        leadData.utm_medium,
        leadData.utm_campaign,
        leadData.page_path,
        leadData.env_name,
        req.ip,
        req.get('User-Agent'),
        leadData.consent
      ]
    );

    const savedLead = result.rows[0];

    // Отправляем уведомление в Telegram (асинхронно)
    setImmediate(async () => {
      try {
        await sendTelegramNotification({
          ...leadData,
          id: savedLead.id,
          created_at: savedLead.created_at
        });
      } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
      }
    });

    console.log(`✅ Новая заявка сохранена: ID ${savedLead.id}, Email: ${leadData.email}`);

    res.status(201).json({
      success: true,
      id: savedLead.id,
      message: 'Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.'
    });
  } catch (error) {
    console.error('❌ Ошибка создания заявки:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера'
    });
  }
};

// Получение списка заявок
export const getLeads = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Получаем список заявок
    const leadsResult = await query(
      `
      SELECT 
        id,
        name,
        email,
        phone,
        company,
        project_type,
        budget,
        message,
        utm_source,
        utm_medium,
        utm_campaign,
        page_path,
        env_name,
        consent,
        created_at,
        updated_at
      FROM leads 
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    // Получаем общее количество заявок
    const countResult = await query(`SELECT COUNT(*) as total FROM leads`);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: leadsResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения заявок:', error);
    res.status(500).json({
      error: 'Ошибка получения заявок',
      code: 'LEADS_FETCH_ERROR'
    });
  }
};

// Получение статистики по заявкам (для админки)
export const getLeadsStats = async (req, res) => {
  try {
    const { default: queryOptimizer } = await import('../services/queryOptimizer.js');
    const result = await queryOptimizer.getLeadsStatsOptimized();
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения статистики заявок:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Default export для совместимости с роутером
export default {
  createLead,
  getLeads,
  getLeadsStats,
  leadRateLimit,
  initializeLeadsTable
};
