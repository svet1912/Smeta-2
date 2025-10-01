import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom fetch polyfill
import 'whatwg-fetch';

afterEach(() => {
  cleanup();
});

// глушим шумные warn/log при тестах (по желанию)
vi.spyOn(console, 'error').mockImplementation((...args) => {
  const msg = (args?.[0] || '').toString();
  if (msg.includes('Warning:')) return;
  // вернуть, если нужно видеть ошибки:
  // console.warn(...args);
});