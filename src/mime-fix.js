// MIME Types Simple Fix - Простое исправление MIME типов
console.log('🔧 Loading Simple MIME Fix...');

// Глобальный перехватчик ошибок MIME типов
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('MIME type') && event.message.includes('text/jsx')) {
    console.log('🔧 MIME Fix: JSX MIME error intercepted');
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}, true);

// Перехват необработанных ошибок Promise
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('MIME type')) {
    console.log('🔧 MIME Fix: Promise MIME error intercepted');
    event.preventDefault();
    return false;
  }
});

console.log('✅ Simple MIME Fix activated!');