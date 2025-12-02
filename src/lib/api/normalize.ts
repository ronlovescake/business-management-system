import type { ApiResponse } from '@/types/api';

function isApiEnvelope<T>(payload: unknown): payload is ApiResponse<T> {
  return (
    !!payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'success' in payload &&
    'data' in payload
  );
}

export function unwrapApiData<T>(payload: unknown): T | undefined {
  if (isApiEnvelope<T>(payload)) {
    if (typeof payload.data !== 'undefined') {
      return payload.data as T;
    }
  }

  return payload as T;
}

export function ensureArray<T>(payload: unknown): T[] {
  const unwrapped = unwrapApiData<T[]>(payload);
  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  if (Array.isArray(payload)) {
    return payload as T[];
  }

  return [];
}
