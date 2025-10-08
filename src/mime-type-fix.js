// MIME Type Fix для JSX модулей в production
// Исправляет проблемы с "text/jsx" MIME типом

console.log('🔧 MIME Type Fix для JSX модулей активируется...');

// 1. Перехватываем динамические импорты
const originalImport = window.__import || (url => import(url));
window.__import = async function(url) {
  try {
    console.log('🔧 Dynamic import intercepted:', url);
    
    // Если URL содержит data:text/jsx, исправляем его
    if (url.includes('data:text/jsx')) {
      console.log('🛠️ Fixing JSX MIME type in data URL');
      // Заменяем MIME тип на application/javascript
      url = url.replace('data:text/jsx', 'data:application/javascript');
    }
    
    return await originalImport.call(this, url);
  } catch (error) {
    if (error.message && error.message.includes('MIME type')) {
      console.log('🛠️ MIME type error caught, attempting alternative import');
      
      // Если это data: URL с JSX, пытаемся исправить
      if (url.includes('data:') && url.includes('jsx')) {
        const correctedUrl = url.replace(/data:text\/jsx/g, 'data:application/javascript');
        try {
          return await originalImport.call(this, correctedUrl);
        } catch (secondError) {
          console.warn('Failed to import with corrected MIME type:', secondError);
        }
      }
      
      // Пытаемся загрузить как обычный модуль
      try {
        const response = await fetch(url);
        const text = await response.text();
        const blob = new Blob([text], { type: 'application/javascript' });
        const objectUrl = URL.createObjectURL(blob);
        return await originalImport.call(this, objectUrl);
      } catch (fetchError) {
        console.warn('Failed to fetch and re-import module:', fetchError);
      }
    }
    
    throw error;
  }
};

// 2. Патчим createElement для обработки JSX в runtime
const originalCreateElement = document.createElement;
document.createElement = function(tagName, options) {
  const element = originalCreateElement.call(this, tagName, options);
  
  // Если создается script элемент с JSX типом, исправляем его
  if (tagName.toLowerCase() === 'script') {
    const originalSetAttribute = element.setAttribute;
    element.setAttribute = function(name, value) {
      if (name === 'type' && value === 'text/jsx') {
        console.log('🛠️ Fixing script type from text/jsx to module');
        value = 'module';
      }
      return originalSetAttribute.call(this, name, value);
    };
  }
  
  return element;
};

// 3. Перехватываем fetch для исправления MIME типов
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
  try {
    const response = await originalFetch.call(this, url, options);
    
    // Если response содержит JSX MIME тип, исправляем заголовки
    if (response.headers.get('content-type')?.includes('text/jsx')) {
      console.log('🛠️ Fixing JSX MIME type in response headers');
      
      // Создаем новый response с правильным MIME типом
      const correctedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'content-type': 'application/javascript; charset=utf-8'
        }
      });
      
      return correctedResponse;
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

console.log('✅ MIME Type Fix для JSX модулей активирован!');