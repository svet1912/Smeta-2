import { vi } from 'vitest';

export function mockFetchOnce(data: any, init: ResponseInit = {}) {
  const json = JSON.stringify(data);
  // @ts-ignore
  global.fetch = vi.fn().mockResolvedValue(
    new Response(json, { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })
  );
}

export function mockFetchSequence(responses: Array<{ data: any; init?: ResponseInit }>) {
  const mocks = responses.map(r =>
    Promise.resolve(new Response(JSON.stringify(r.data), {
      status: 200, headers: { 'Content-Type': 'application/json' }, ...(r.init || {})
    }))
  );
  // @ts-ignore
  global.fetch = vi.fn().mockImplementation(() => mocks.shift()!);
}