// React 18 Compatibility Polyfill
// Мягкое исправление для совместимости с устаревшими библиотеками

import React from 'react';

// Убеждаемся что React доступен глобально перед любыми исправлениами
if (typeof window !== 'undefined') {
  window.React = window.React || React;
}
if (typeof globalThis !== 'undefined') {
  globalThis.React = globalThis.React || React;
}

// Определяем безопасный polyfill только если нужно
function ensureReactCompat(reactObj) {
  if (reactObj && typeof reactObj === 'object') {
    if (!reactObj.AsyncMode && reactObj.Fragment) {
      reactObj.AsyncMode = reactObj.Fragment;
    }
    if (!reactObj.unstable_AsyncMode && reactObj.Fragment) {
      reactObj.unstable_AsyncMode = reactObj.Fragment;
    }
  }
}

// Применяем polyfill к React объектам
ensureReactCompat(React);
if (typeof window !== 'undefined' && window.React) {
  ensureReactCompat(window.React);
}
if (typeof globalThis !== 'undefined' && globalThis.React) {
  ensureReactCompat(globalThis.React);
}

// Отслеживаем что polyfill загрузился
console.log('React 18 compatibility polyfill loaded - React available:', !!React);

export default React;