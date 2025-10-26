/**
 * Query Parameter Utilities
 *
 * Helper functions for building URL query parameters
 */

/**
 * Build query string from object
 *
 * @example
 * ```ts
 * buildQueryString({ page: 1, limit: 10, filter: 'active' })
 * // Returns: "?page=1&limit=10&filter=active"
 * ```
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Build URL with query parameters
 *
 * @example
 * ```ts
 * buildURL('/api/users', { page: 1, limit: 10 })
 * // Returns: "/api/users?page=1&limit=10"
 * ```
 */
export function buildURL(
  url: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  if (!params) {
    return url;
  }

  const queryString = buildQueryString(params);
  return `${url}${queryString}`;
}

/**
 * Parse query string into object
 *
 * @example
 * ```ts
 * parseQueryString('?page=1&limit=10')
 * // Returns: { page: '1', limit: '10' }
 * ```
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(queryString);

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}
