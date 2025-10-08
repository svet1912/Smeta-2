import { createRoot } from 'react-dom/client';

// MIME Types fix - MUST be loaded first
import './mime-fix';
// Emergency AsyncMode patch - MUST be loaded absolutely first
import './emergency-asyncmode-patch';
// Vendor patches - must be loaded first
import './vendor-patches';
// React 18 AsyncMode polyfill - must be loaded first
import './react18-polyfill';

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

// project imports
import App from './App';
import reportWebVitals from './reportWebVitals';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from 'utils/queryClient';

const container = document.getElementById('root');
const root = createRoot(container);

// ==============================|| MAIN - REACT DOM RENDER ||============================== //

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
