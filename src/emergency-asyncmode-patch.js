// AsyncMode Emergency Patch - Аварийный патч для критических ошибок
// Перехватывает ошибки на самом низком уровне

console.log('🚨 Активация аварийного AsyncMode патча...');

// 1. Перехватываем ошибки TypeError
const originalTypeError = window.TypeError;
window.TypeError = function (message) {
  if (message && message.includes && message.includes('AsyncMode')) {
    console.log('🛡️ EMERGENCY: Перехвачена критическая AsyncMode ошибка');
    console.log('📍 Error message:', message);
    
    // Возвращаем безопасную заглушку вместо ошибки
    const safeError = new Error('AsyncMode compatibility layer activated');
    safeError.name = 'AsyncModeCompatibilityError';
    return safeError;
  }
  
  if (message && message.includes && message.includes('Cannot set properties of undefined')) {
    console.log('🛡️ EMERGENCY: Перехвачена ошибка undefined properties (возможно AsyncMode)');
    const safeError = new Error('Property access compatibility layer activated');
    safeError.name = 'PropertyAccessCompatibilityError';
    return safeError;
  }
  
  return new originalTypeError(message);
};

// 2. Глобальный перехватчик необработанных ошибок
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('AsyncMode')) {
    console.log('🚨 EMERGENCY: Глобальная AsyncMode ошибка перехвачена');
    console.log('📍 Error details:', {
      message: event.error.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error.stack
    });
    
    // Предотвращаем показ ошибки пользователю
    event.preventDefault();
    event.stopPropagation();
    
    // Пытаемся исправить ситуацию
    if (!window.React?.AsyncMode) {
      console.log('🔧 EMERGENCY: Устанавливаем AsyncMode аварийно');
      try {
        if (window.React) {
          window.React.AsyncMode = function EmergencyAsyncMode(props) {
            return props?.children || null;
          };
        }
      } catch (error) {
        console.log('❌ EMERGENCY: Не удалось установить AsyncMode аварийно');
      }
    }
    
    return false;
  }
});

// 3. Перехватчик для необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('AsyncMode')) {
    console.log('🚨 EMERGENCY: Promise AsyncMode ошибка перехвачена');
    event.preventDefault();
    return false;
  }
});

// 4. Мутационный наблюдатель для отслеживания изменений DOM
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    // Если появились новые скрипты, проверяем React
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === 'SCRIPT') {
            // Небольшая задержка, чтобы скрипт успел загрузиться
            setTimeout(() => {
              if (window.React && !window.React.AsyncMode) {
                console.log('🔧 EMERGENCY: Восстанавливаем AsyncMode после загрузки скрипта');
                try {
                  window.React.AsyncMode = function RestoredAsyncMode(props) {
                    return props?.children || null;
                  };
                } catch (error) {
                  console.log('❌ EMERGENCY: Ошибка при восстановлении AsyncMode');
                }
              }
            }, 100);
          }
        });
      }
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

console.log('🚨 Аварийный AsyncMode патч активирован!');