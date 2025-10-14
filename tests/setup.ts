// Global test setup
import { afterEach, vi } from 'vitest';

// Cleanup after each test case
afterEach(() => {
  vi.clearAllMocks();
});

// Mock fetch globally if it doesn't exist
if (!global.fetch) {
  global.fetch = vi.fn() as unknown as typeof fetch;
}

// eslint-disable-next-line no-console
console.log('🧪 Test environment initialized');


