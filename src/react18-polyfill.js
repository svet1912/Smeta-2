// React 18 Compatibility Polyfill// React 18 Compatibility Polyfill

// Исправляет ошибки с устаревшими React API// Исправляет ошибки с устаревшими React API



// Polyfill для AsyncMode (удален в React 18)// Polyfill для AsyncMode (удален в React 18)

if (typeof window !== 'undefined' && window.React) {if (typeof window !== 'undefined' && window.React) {

  if (!window.React.AsyncMode) {  if (!window.React.AsyncMode) {

    window.React.AsyncMode = window.React.Fragment;    window.React.AsyncMode = window.React.Fragment;

  }  }

  if (!window.React.unstable_AsyncMode) {  if (!window.React.unstable_AsyncMode) {

    window.React.unstable_AsyncMode = window.React.Fragment;    window.React.unstable_AsyncMode = window.React.Fragment;

  }  }

}}



// Polyfill для глобального React объекта// Polyfill для глобального React объекта

if (typeof globalThis !== 'undefined') {if (typeof globalThis !== 'undefined') {

  if (globalThis.React && !globalThis.React.AsyncMode) {  if (globalThis.React && !globalThis.React.AsyncMode) {

    globalThis.React.AsyncMode = globalThis.React.Fragment;    globalThis.React.AsyncMode = globalThis.React.Fragment;

    globalThis.React.unstable_AsyncMode = globalThis.React.Fragment;    globalThis.React.unstable_AsyncMode = globalThis.React.Fragment;

  }  }

}}



export {};export {};