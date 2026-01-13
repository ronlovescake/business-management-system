import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

if (!global.fetch) {
  global.fetch = vi.fn() as unknown as typeof fetch;
}

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

window.confirm = vi.fn(() => true);

if (!window.ResizeObserver) {
  class ResizeObserver {
    observe() {
      // noop
    }
    unobserve() {
      // noop
    }
    disconnect() {
      // noop
    }
  }

  window.ResizeObserver =
    ResizeObserver as unknown as typeof window.ResizeObserver;
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});
