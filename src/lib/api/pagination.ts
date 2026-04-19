/**
 * Server-side helpers for parsing pagination query params and shaping
 * standard `PaginatedResponse<T>` envelopes.
 *
 * Conventions (see docs/BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md \u00a7 API
 * Contract Standard):
 *
 *   - `?limit=` (default 50, max 500)
 *   - `?offset=` (default 0)
 *   - response: { success, data, pagination: { page, limit, total, pages } }
 *
 * These helpers do not assume a particular HTTP framework. They produce a
 * plain object that can be wrapped with `NextResponse.json(...)`.
 */

import type { PaginatedResponse } from '@/types/api';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 500;
export const MIN_PAGE_LIMIT = 1;

export interface PaginationParams {
  /** Clamped page size: [MIN_PAGE_LIMIT, MAX_PAGE_LIMIT]. */
  limit: number;
  /** Zero-based offset; clamped to >= 0. */
  offset: number;
  /** 1-based page derived from limit + offset. */
  page: number;
}

/**
 * Parse pagination params from any URL-like input.
 *
 * Accepts either a `URL`, a `URLSearchParams`, or a `Request` (Web Fetch
 * compatible). Unknown inputs fall back to defaults.
 */
export function parsePaginationParams(
  input: URL | URLSearchParams | Request | { url: string } | string | undefined
): PaginationParams {
  const params = toSearchParams(input);

  const rawLimit = params?.get('limit');
  const rawOffset = params?.get('offset');
  const rawPage = params?.get('page');

  const limit = clampLimit(toFiniteNumber(rawLimit, DEFAULT_PAGE_LIMIT));

  let offset = Math.max(0, toFiniteNumber(rawOffset, 0));

  // If `?page=` is provided and `?offset=` is not, derive offset from page.
  if (rawOffset === null || rawOffset === undefined || rawOffset === '') {
    if (rawPage !== null && rawPage !== undefined && rawPage !== '') {
      const page = Math.max(1, toFiniteNumber(rawPage, 1));
      offset = (page - 1) * limit;
    }
  }

  return {
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
  };
}

/**
 * Build a standard `PaginatedResponse<T>` envelope.
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: { total: number; limit: number; offset: number }
): PaginatedResponse<T> {
  const limit = clampLimit(pagination.limit);
  const total = Math.max(0, pagination.total | 0);
  const offset = Math.max(0, pagination.offset | 0);
  const pages = total === 0 ? 0 : Math.ceil(total / limit);
  const page = Math.floor(offset / limit) + 1;

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  };
}

/**
 * Combine `parsePaginationParams` and Prisma-style `take` / `skip`.
 *
 * Usage:
 *   const { take, skip, page, limit } = paginationFor(request);
 *   const [items, total] = await Promise.all([
 *     prisma.thing.findMany({ where, take, skip, orderBy }),
 *     prisma.thing.count({ where }),
 *   ]);
 *   return NextResponse.json(paginatedResponse(items, { total, limit, offset: skip }));
 */
export function paginationFor(
  input: URL | URLSearchParams | Request | { url: string } | string | undefined
): PaginationParams & { take: number; skip: number } {
  const parsed = parsePaginationParams(input);
  return {
    ...parsed,
    take: parsed.limit,
    skip: parsed.offset,
  };
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PAGE_LIMIT;
  }
  return Math.max(MIN_PAGE_LIMIT, Math.min(MAX_PAGE_LIMIT, Math.floor(value)));
}

function toFiniteNumber(
  value: string | null | undefined,
  fallback: number
): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toSearchParams(
  input: URL | URLSearchParams | Request | { url: string } | string | undefined
): URLSearchParams | null {
  if (!input) {
    return null;
  }
  if (input instanceof URLSearchParams) {
    return input;
  }
  if (typeof input === 'string') {
    try {
      return new URL(input, 'http://x').searchParams;
    } catch {
      return null;
    }
  }
  if (input instanceof URL) {
    return input.searchParams;
  }
  if (typeof (input as { url?: unknown }).url === 'string') {
    try {
      return new URL((input as { url: string }).url, 'http://x').searchParams;
    } catch {
      return null;
    }
  }
  return null;
}
