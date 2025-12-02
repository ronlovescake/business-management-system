import type { ApiResponse } from '@/types/api';

/**
 * Ensure an API response indicates success, throwing if not.
 */
export function assertApiSuccess(
  response: ApiResponse<unknown>,
  fallbackMessage = 'Request failed'
): void {
  if (response.success) {
    return;
  }
  throw new Error(response.error || fallbackMessage);
}

/**
 * Extract data from an API response, ensuring it succeeded.
 */
export function getApiDataOrThrow<T>(
  response: ApiResponse<T>,
  fallbackMessage = 'Request failed'
): T {
  assertApiSuccess(response, fallbackMessage);
  if (response.data === undefined) {
    throw new Error(fallbackMessage);
  }
  return response.data;
}
