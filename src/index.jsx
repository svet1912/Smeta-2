import { createRoot } from 'react-dom/client';

console.log('🚀 Index.jsx loading started');

// MIME Types fix - MUST be loaded first
import './mime-fix';
// NOTE: Removed aggressive AsyncMode/vendor patches that touched window.React too early
// If needed, they can be reintroduced after React is guaranteed to be initialized.

console.log('✅ Imports phase 1 complete');

// style.scss
import 'assets/style.css';

// scroll bar
import 'simplebar-react/dist/simplebar.min.css';

// apex-chart
import 'assets/third-party/apex-chart.css';
import 'assets/third-party/react-table.css';

// google-fonts
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/700.css';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';

console.log('✅ CSS imports complete');

// project imports
import App from './App';
import reportWebVitals from './reportWebVitals';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'utils/queryClient';

console.log('✅ All imports complete');

const container = document.getElementById('root');
console.log('📋 Container element:', container);

if (!container) {
  console.error('❌ Root container not found!');
  throw new Error('Root container element not found');
}

const root = createRoot(container);
console.log('✅ React root created');

// ==============================|| MAIN - REACT DOM RENDER ||============================== //

console.log('🎯 Starting render...');
try {
  root.render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
  console.log('✅ Render call completed');
} catch (error) {
  console.error('❌ Render failed:', error);
  throw error;
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
