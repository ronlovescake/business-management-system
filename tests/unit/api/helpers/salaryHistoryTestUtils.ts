import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

export type SalaryHistoryRouteParams = { params: { id: string } };

export interface SalaryHistoryRequestOptions {
  id?: string;
  body?: Record<string, unknown>;
}

export function buildSalaryHistoryRequest(
  basePath: string,
  method: string,
  options: SalaryHistoryRequestOptions = {}
) {
  const { id = 'EMP001', body } = options;
  return new NextRequest(getTestApiUrl(`${basePath}/${id}/salary-history`), {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function buildSalaryHistoryRouteParams(
  id: string
): SalaryHistoryRouteParams {
  return { params: { id } };
}

export function ensureTestDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://testuser:testpass@localhost:5432/testdb';
  }
}
