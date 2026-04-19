import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  paginatedResponse,
  paginationFor,
  parsePaginationParams,
} from '@/lib/api/pagination';

describe('parsePaginationParams', () => {
  it('returns defaults when nothing is provided', () => {
    expect(parsePaginationParams(undefined)).toEqual({
      limit: DEFAULT_PAGE_LIMIT,
      offset: 0,
      page: 1,
    });
  });

  it('parses ?limit and ?offset from a URL', () => {
    const url = new URL('http://x/api/things?limit=25&offset=50');
    expect(parsePaginationParams(url)).toEqual({
      limit: 25,
      offset: 50,
      page: 3,
    });
  });

  it('clamps limit to MAX_PAGE_LIMIT', () => {
    const url = new URL(`http://x/api/things?limit=${MAX_PAGE_LIMIT + 100}`);
    expect(parsePaginationParams(url).limit).toBe(MAX_PAGE_LIMIT);
  });

  it('floors negative offset at 0', () => {
    const url = new URL('http://x/api/things?offset=-10');
    expect(parsePaginationParams(url).offset).toBe(0);
  });

  it('falls back to defaults on garbage values', () => {
    const url = new URL('http://x/api/things?limit=abc&offset=xyz');
    expect(parsePaginationParams(url)).toEqual({
      limit: DEFAULT_PAGE_LIMIT,
      offset: 0,
      page: 1,
    });
  });

  it('derives offset from ?page when offset is absent', () => {
    const url = new URL('http://x/api/things?page=4&limit=10');
    expect(parsePaginationParams(url)).toEqual({
      limit: 10,
      offset: 30,
      page: 4,
    });
  });

  it('accepts a Request-like input', () => {
    const req = new Request('http://x/api/things?limit=5&offset=15');
    expect(parsePaginationParams(req)).toEqual({
      limit: 5,
      offset: 15,
      page: 4,
    });
  });
});

describe('paginationFor', () => {
  it('exposes Prisma-style take and skip aliases', () => {
    const url = new URL('http://x/api/things?limit=20&offset=40');
    const p = paginationFor(url);
    expect(p.take).toBe(20);
    expect(p.skip).toBe(40);
    expect(p.page).toBe(3);
  });
});

describe('paginatedResponse', () => {
  it('builds a standard envelope', () => {
    const env = paginatedResponse([1, 2, 3], {
      total: 53,
      limit: 10,
      offset: 20,
    });
    expect(env.success).toBe(true);
    expect(env.data).toEqual([1, 2, 3]);
    expect(env.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 53,
      pages: 6,
    });
  });

  it('reports pages=0 when total=0', () => {
    const env = paginatedResponse([], { total: 0, limit: 10, offset: 0 });
    expect(env.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      pages: 0,
    });
  });
});
