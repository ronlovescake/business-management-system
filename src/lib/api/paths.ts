export const DEFAULT_API_BASE = '/api';

export function buildApiPath(
  apiBasePath: string | undefined,
  path: string
): string {
  const base = (apiBasePath ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
