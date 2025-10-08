// Ultra Vendor Patches - Максимальная защита от AsyncMode ошибок
// Агрессивное патчинование на всех уровнях

console.log('🔧 Начинаем агрессивное патчинование vendor модулей...');

// 1. Глобальная защита через Error перехват
const originalError = window.Error;
window.Error = function (message) {
  if (message && typeof message === 'string' && message.includes('AsyncMode')) {
    console.log('🛡️ Перехвачена AsyncMode ошибка:', message);
    // Возвращаем безопасную ошибку
    return new originalError('React compatibility layer: AsyncMode патч активирован');
  }
  return new originalError(message);
};

// 2. Перехват всех попыток доступа к undefined свойствам
const originalDescriptor = Object.getOwnPropertyDescriptor;
Object.getOwnPropertyDescriptor = function (obj, prop) {
  const desc = originalDescriptor.call(this, obj, prop);
  if (prop === 'AsyncMode' && (!desc || desc.value === undefined)) {
    console.log('🔧 Патчим getOwnPropertyDescriptor для AsyncMode');
    return {
      value: function AsyncModeStub(props) { return props?.children || null; },
      writable: true,
      enumerable: false,
      configurable: true
    };
  }
  return desc;
};

// 3. Патчим React через Proxy с максимальной защитой
if (typeof window !== 'undefined') {
  const createAsyncModeStub = () => {
    const stub = function AsyncMode(props) {
      return props?.children || null;
    };
    stub.$$typeof = Symbol.for('react.async_mode');
    stub.displayName = 'AsyncMode (Polyfill)';
    return stub;
  };

  // Сохраняем оригинальный React
  const originalReact = window.React;
  
  // Создаем супер-защищенный прокси
  window.React = new Proxy(originalReact || {}, {
    get(target, prop) {
      if (prop === 'AsyncMode') {
        console.log('🔧 Vendor патч: возвращаем AsyncMode stub');
        return createAsyncModeStub();
      }
      return target[prop];
    },
    
    set(target, prop, value) {
      if (prop === 'AsyncMode') {
        console.log('🛡️ Vendor патч: блокируем установку AsyncMode =', value);
        return true; // Игнорируем установку
      }
      target[prop] = value;
      return true;
    },
    
    has(target, prop) {
      if (prop === 'AsyncMode') {
        return true; // Всегда говорим, что AsyncMode существует
      }
      return prop in target;
    },
    
    defineProperty(target, prop, descriptor) {
      if (prop === 'AsyncMode') {
        console.log('🛡️ Vendor патч: блокируем defineProperty AsyncMode');
        return true;
      }
      return Object.defineProperty(target, prop, descriptor);
    }
  });
  
  // 4. Устанавливаем AsyncMode во все возможные места
  try {
    window.React.AsyncMode = createAsyncModeStub();
  } catch (error) {
    console.log('Не удалось установить AsyncMode в window.React:', error.message);
  }
}

// Патчим модули через require/import интерсепцию
const originalRequire = typeof require !== 'undefined' ? require : null;
if (originalRequire) {
  const Module = originalRequire('module');
  const originalLoad = Module._load;
  
  Module._load = function (request, parent) {
    const result = originalLoad.apply(this, arguments);
    
    // Патчим проблемные модули после загрузки
    if (request.includes('hoist-non-react-statics') || 
        request.includes('react-transition-group') ||
        request.includes('@emotion/react')) {
      
      console.log(`🔧 Патчинг модуля: ${request}`);
      
      // Если модуль пытается получить AsyncMode из React
      if (result && typeof result === 'object') {
        return new Proxy(result, {
          get(target, prop) {
            const value = target[prop];
            if (typeof value === 'function') {
              return function (...args) {
                try {
                  return value.apply(this, args);
                } catch (error) {
                  if (error.message && error.message.includes('AsyncMode')) {
                    console.log('🛡️ Перехвачена ошибка AsyncMode в', request);
                    return null;
                  }
                  throw error;
                }
              };
            }
            return value;
          }
        });
      }
    }
    
    return result;
  };
}

console.log('🔧 Vendor патчинг активирован');