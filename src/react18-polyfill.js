// React 18 Compatibility Polyfill
// Исправляет ошибки с устаревшими React API

import React from 'react';

// Polyfill для AsyncMode (удален в React 18)
if (!React.AsyncMode) {
  React.AsyncMode = React.Fragment;
}
if (!React.unstable_AsyncMode) {
  React.unstable_AsyncMode = React.Fragment;
}

// Глобальный polyfill для window.React
if (typeof window !== 'undefined') {
  window.React = React;
  if (!window.React.AsyncMode) {
    window.React.AsyncMode = React.Fragment;
  }
  if (!window.React.unstable_AsyncMode) {
    window.React.unstable_AsyncMode = React.Fragment;
  }
}

// Polyfill для globalThis.React
if (typeof globalThis !== 'undefined') {
  globalThis.React = React;
  if (!globalThis.React.AsyncMode) {
    globalThis.React.AsyncMode = React.Fragment;
    globalThis.React.unstable_AsyncMode = React.Fragment;
  }
}

console.log('React 18 AsyncMode polyfill loaded:', {
  AsyncMode: !!React.AsyncMode,
  unstable_AsyncMode: !!React.unstable_AsyncMode
});

export default React;