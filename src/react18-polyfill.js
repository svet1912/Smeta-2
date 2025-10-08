// React 18 AsyncMode Polyfill - Ultra Defense Version
// Максимальная защита от ошибок AsyncMode

import React from 'react';

// AsyncMode Супер-полифилл с максимальной защитой
const polyfillAsyncMode = () => {
  console.log('🛡️ Activating AsyncMode Super Defense...');

  // 1. Создаем AsyncMode как функцию-заглушку
  const AsyncModeStub = function AsyncMode(props) {
    return React.createElement(React.Fragment, props);
  };
  
  // 2. Добавляем все возможные свойства для совместимости
  AsyncModeStub.$$typeof = Symbol.for('react.async_mode');
  AsyncModeStub.displayName = 'AsyncMode';
  AsyncModeStub.prototype = React.Component.prototype;
  
  // 3. Устанавливаем AsyncMode в React с защитой от переопределения
  const reactProxy = new Proxy(React, {
    get(target, prop) {
      if (prop === 'AsyncMode') {
        return AsyncModeStub;
      }
      return target[prop];
    },
    
    set(target, prop, value) {
      if (prop === 'AsyncMode') {
        console.log('🛡️ Блокирована попытка установить AsyncMode:', value);
        return true; // Игнорируем установку
      }
      target[prop] = value;
      return true;
    },
    
    defineProperty(target, prop, descriptor) {
      if (prop === 'AsyncMode') {
        console.log('🛡️ Блокирована попытка defineProperty AsyncMode');
        return true; // Игнорируем
      }
      return Object.defineProperty(target, prop, descriptor);
    }
  });

  // 4. Заменяем React глобально через прокси
  if (typeof window !== 'undefined') {
    // Сохраняем оригинальный React
    window.__originalReact = window.React || React;
    
    // Устанавливаем прокси как React
    window.React = reactProxy;
    
    // Также устанавливаем AsyncMode напрямую
    try {
      Object.defineProperty(window.React, 'AsyncMode', {
        value: AsyncModeStub,
        writable: false,
        enumerable: false,
        configurable: false
      });
    } catch (error) {
      // Если не получается через defineProperty, устанавливаем напрямую
      console.log('Fallback: устанавливаем AsyncMode напрямую:', error.message);
      window.React.AsyncMode = AsyncModeStub;
    }
  }

  // 5. Патчим Object.defineProperty глобально
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function (target, prop, descriptor) {
    // Если кто-то пытается установить AsyncMode как undefined
    if (prop === 'AsyncMode' && descriptor && descriptor.value === undefined) {
      console.log('🛡️ Заблокирована установка AsyncMode = undefined');
      // Заменяем на наш stub
      descriptor = {
        ...descriptor,
        value: AsyncModeStub,
        writable: false
      };
    }
    
    try {
      return originalDefineProperty.call(this, target, prop, descriptor);
    } catch (error) {
      if (prop === 'AsyncMode') {
        console.log('🛡️ Ошибка при установке AsyncMode перехвачена:', error.message);
        return target; // Возвращаем объект без изменений
      }
      throw error;
    }
  };

  // 6. Устанавливаем AsyncMode и в основном React объекте
  try {
    React.AsyncMode = AsyncModeStub;
  } catch (e) {
    console.log('Не удалось установить React.AsyncMode напрямую:', e.message);
  }

  console.log('✅ AsyncMode Super Defense активирован!');
};

// Применяем полифилл при загрузке модуля
polyfillAsyncMode();

export default polyfillAsyncMode;
