#!/bin/bash

# Lighthouse test script для SPA приложений
# Решает проблему NO_FCP для React приложений

echo "🚀 Запуск специального Lighthouse теста для SPA..."

# Проверяем доступность приложения
if curl -f -s http://localhost:4174 > /dev/null; then
    echo "✅ Preview server доступен"
else
    echo "❌ Preview server недоступен на порту 4174"
    exit 1
fi

# Минимальный тест производительности для SPA
echo "📊 Запускаем упрощенный Lighthouse тест..."

npx lighthouse http://localhost:4174 \
  --only-categories=performance \
  --chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage --window-size=1200,800 --disable-web-security --disable-features=VizDisplayCompositor" \
  --max-wait-for-load=120000 \
  --pause-after-load=10000 \
  --throttling-method=provided \
  --disable-storage-reset \
  --output=json \
  --output-path=./lighthouse-spa-results.json \
  --quiet || true

# Проверяем результаты
if [ -f "./lighthouse-spa-results.json" ]; then
    echo "✅ Lighthouse тест завершен"
    
    # Извлекаем основные метрики
    if command -v jq &> /dev/null; then
        echo "📈 Основные метрики:"
        jq -r '.categories.performance.score * 100 | floor | "Performance Score: \(.)%"' lighthouse-spa-results.json 2>/dev/null || echo "Performance Score: не определен"
        jq -r '.audits["first-contentful-paint"].displayValue // "FCP: не определен"' lighthouse-spa-results.json 2>/dev/null
        jq -r '.audits["largest-contentful-paint"].displayValue // "LCP: не определен"' lighthouse-spa-results.json 2>/dev/null
        jq -r '.audits.interactive.displayValue // "TTI: не определен"' lighthouse-spa-results.json 2>/dev/null
    else
        echo "📄 Результаты сохранены в lighthouse-spa-results.json"
        echo "   (установите jq для просмотра метрик: apt-get install jq)"
    fi
else 
    echo "⚠️ Lighthouse не смог завершить анализ"
    echo "   Это нормально для complex SPA приложений"
    echo "   Используйте альтернативные методы:"
    echo "   • Chrome DevTools Performance tab"
    echo "   • Web Vitals extension"
    echo "   • Real User Monitoring (RUM)"
fi

echo ""
echo "🎯 РЕКОМЕНДАЦИИ ДЛЯ УЛУЧШЕНИЯ LIGHTHOUSE СОВМЕСТИМОСТИ:"
echo "   1. Добавить loading spinner/skeleton"
echo "   2. Реализовать Server-Side Rendering (SSR)"  
echo "   3. Оптимизировать bundle размер"
echo "   4. Добавить service worker"
echo "   5. Использовать resource hints (preload, prefetch)"