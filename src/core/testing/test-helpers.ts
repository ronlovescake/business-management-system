/**
 * Test Helpers
 *
 * Utilities for unit, integration, and E2E tests
 */

import { vi } from 'vitest';
import type { NextRequest } from 'next/server';

type MockPrismaClientShape = {
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
} & Record<string, unknown>;

type MockNextRequest = NextRequest & {
  json: ReturnType<typeof vi.fn>;
  text: ReturnType<typeof vi.fn>;
  formData: ReturnType<typeof vi.fn>;
  arrayBuffer: ReturnType<typeof vi.fn>;
  blob: ReturnType<typeof vi.fn>;
};

/**
 * Test environment base URL
 * Use this constant instead of hardcoding localhost:3000 in tests
 */
export const TEST_BASE_URL = 'http://localhost:3000';

/**
 * Helper to build test API URLs
 *
 * @example
 * ```typescript
 * const url = getTestApiUrl('/api/customers'); // "http://localhost:3000/api/customers"
 * const url = getTestApiUrl('/api/customers', { status: 'active' }); // "http://localhost:3000/api/customers?status=active"
 * ```
 */
export function getTestApiUrl(
  path: string,
  params?: Record<string, string>
): string {
  const url = new URL(path, TEST_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

/**
 * Mock Prisma Client
 *
 * @example
 * const mockPrisma = mockPrismaClient({
 *   expense: {
 *     findMany: vi.fn().mockResolvedValue([mockExpense]),
 *     create: vi.fn().mockResolvedValue(mockExpense),
 *   },
 * });
 */
export function mockPrismaClient(
  overrides: Record<string, unknown> = {}
): MockPrismaClientShape {
  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((callback: (prisma: unknown) => unknown) =>
      callback(mockPrismaClient(overrides))
    ),
    ...overrides,
  };
}

/**
 * Mock NextRequest
 *
 * @example
 * const request = mockNextRequest({
 *   method: 'POST',
 *   body: { name: 'Test' },
 *   searchParams: { page: '1' },
 * });
 */
export function mockNextRequest(
  options: {
    method?: string;
    url?: string;
    body?: unknown;
    searchParams?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): MockNextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body,
    searchParams = {},
    headers = {},
  } = options;

  const searchParamsObj = new URLSearchParams(searchParams);
  const fullUrl = `${url}?${searchParamsObj.toString()}`;

  return {
    method,
    url: fullUrl,
    nextUrl: new URL(fullUrl),
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    formData: vi.fn(),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
  } as MockNextRequest;
}

/**
 * Mock Service
 *
 * @example
 * const mockService = mockService({
 *   findAll: vi.fn().mockResolvedValue([mockExpense]),
 *   create: vi.fn().mockResolvedValue(mockExpense),
 * });
 */
export function mockService<T>(methods: Record<string, unknown>) {
  return methods as T;
}

/**
 * Test Data Factories
 *
 * @example
 * const expense = createTestExpense({ amount: 1000 });
 * const expenses = createTestExpenseArray(5);
 */

// Generic factory
export function createTestFactory<T>(
  defaults: T,
  generator?: (index: number) => Partial<T>
) {
  return {
    /**
     * Create single test entity
     */
    create: (overrides: Partial<T> = {}): T => ({
      ...defaults,
      ...overrides,
    }),

    /**
     * Create array of test entities
     */
    createMany: (count: number, overrides?: Partial<T>): T[] => {
      return Array.from({ length: count }, (_, i) => ({
        ...defaults,
        ...(generator ? generator(i) : {}),
        ...overrides,
      }));
    },
  };
}

/**
 * Wait for async operations
 *
 * @example
 * await waitFor(() => expect(element).toBeInTheDocument());
 */
export async function waitFor(
  callback: () => void | Promise<void>,
  options: { timeout?: number; interval?: number } = {}
) {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await callback();
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Mock logger to prevent console spam in tests
 */
export const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  success: vi.fn(),
};

/**
 * Create test context
 *
 * @example
 * const ctx = createTestContext();
 * afterEach(() => ctx.cleanup());
 */
export function createTestContext() {
  const cleanup: (() => void | Promise<void>)[] = [];

  return {
    /**
     * Register cleanup function
     */
    addCleanup: (fn: () => void | Promise<void>) => {
      cleanup.push(fn);
    },

    /**
     * Run all cleanup functions
     */
    cleanup: async () => {
      for (const fn of cleanup.reverse()) {
        await fn();
      }
      cleanup.length = 0;
    },
  };
}
