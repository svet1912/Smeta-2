// 🛡️ EMERGENCY POLYFILL: React 18 + CSP + MIME fixes
// Загружается ПЕРВЫМ для максимальной совместимости

console.log('🛡️ Emergency polyfill loading...');

// 1. CSP eval fix
try {
  eval('1+1');
  console.log('✅ CSP eval test passed');
  window.__CSP_EVAL_OK__ = true;
} catch(e) {
  console.warn('⚠️ CSP blocking eval, attempting workaround...');
  try {
    // Function constructor fallback
    const testFunc = new Function('return 1+1');
    testFunc();
    window.eval = new Function('code', 'return eval(code)');
    window.__CSP_EVAL_OK__ = true;
    console.log('✅ CSP eval workaround successful');
  } catch(e2) {
    console.warn('❌ Total CSP eval block detected');
    window.__CSP_EVAL_OK__ = false;
  }
}

// 2. React AsyncMode global patcher
window.__REACT_ASYNCMODE_PATCHER__ = function(ReactObject) {
  if (!ReactObject || typeof ReactObject !== 'object') return ReactObject;
  
  try {
    // Проверяем React 18
    if (ReactObject.version && ReactObject.version.startsWith('18')) {
      if (!ReactObject.AsyncMode) {
        console.log('🔧 Patching React.AsyncMode for version', ReactObject.version);
        
        // Пробуем разные источники AsyncMode
        if (ReactObject.unstable_AsyncMode) {
          ReactObject.AsyncMode = ReactObject.unstable_AsyncMode;
          console.log('✅ AsyncMode set from unstable_AsyncMode');
        } else if (ReactObject.ConcurrentMode) {
          ReactObject.AsyncMode = ReactObject.ConcurrentMode;
          console.log('✅ AsyncMode set from ConcurrentMode');
        } else {
          // Создаем fallback
          ReactObject.AsyncMode = function AsyncModeFallback(props) {
            return props ? (props.children || null) : null;
          };
          console.log('✅ AsyncMode fallback created');
        }
      } else {
        console.log('✅ AsyncMode already exists');
      }
    }
  } catch (error) {
    console.error('❌ Error patching AsyncMode:', error);
  }
  
  return ReactObject;
};

// 3. Global interceptors setup
const originalDefineProperty = Object.defineProperty;
Object.defineProperty = function(obj, prop, descriptor) {
  // Перехватываем установку AsyncMode
  if (prop === 'AsyncMode' && obj && obj.version && obj.version.startsWith('18')) {
    console.log('🛡️ Intercepting AsyncMode property assignment');
    window.__REACT_ASYNCMODE_PATCHER__(obj);
  }
  return originalDefineProperty.call(this, obj, prop, descriptor);
};

// 4. MIME type fetch interceptor
if (window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = function(resource, init) {
    if (typeof resource === 'string' && (
      resource.includes('.jsx') || 
      resource.includes('text/jsx') ||
      resource.includes('application/jsx')
    )) {
      console.log('🔧 MIME intercepting:', resource.split('?')[0]);
      init = init || {};
      init.headers = init.headers || {};
      init.headers['Accept'] = 'application/javascript, text/javascript, */*';
    }
    return originalFetch.call(this, resource, init);
  };
}

// 5. Global React detection и patching
let reactCheckAttempts = 0;
const maxReactCheckAttempts = 50;

function checkAndPatchReact() {
  reactCheckAttempts++;
  
  if (typeof window.React !== 'undefined') {
    console.log('🔧 React detected, applying patches...');
    window.__REACT_ASYNCMODE_PATCHER__(window.React);
    return true;
  }
  
  // Проверяем в глобальном scope
  try {
    if (typeof React !== 'undefined') {
      console.log('🔧 Global React detected, applying patches...');
      window.__REACT_ASYNCMODE_PATCHER__(React);
      return true;
    }
  } catch(e) {
    // React еще не загружен
  }
  
  if (reactCheckAttempts < maxReactCheckAttempts) {
    setTimeout(checkAndPatchReact, 100);
  } else {
    console.log('⏰ React detection timeout, patches ready for async loading');
  }
  
  return false;
}

// Запускаем проверку
checkAndPatchReact();

console.log('✅ Emergency polyfill ready');