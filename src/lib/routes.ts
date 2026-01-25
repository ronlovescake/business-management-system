const BUSINESS_SEGMENTS = new Set([
  'clothing',
  'trucking',
  'general-merchandise',
  'personal',
]);

const WORKSPACE_SEGMENTS = new Set([
  'operations',
  'employees',
  'accounting',
  'expenses',
  'personal',
]);

const DEFAULT_BUSINESS = 'clothing';
const DEFAULT_WORKSPACE = 'operations';
const MESSAGING_BUSINESSES = new Set(['clothing']);

function normalizeSegment(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.trim();
}

function normalizePath(path?: string | null): string {
  if (!path) {
    return '';
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function resolveBusinessSegment(
  business?: string | null,
  fallback: string = DEFAULT_BUSINESS
): string {
  const normalized = normalizeSegment(business);
  if (normalized && BUSINESS_SEGMENTS.has(normalized)) {
    return normalized;
  }
  return fallback;
}

export function resolveWorkspaceSegment(
  workspace?: string | null,
  fallback: string = DEFAULT_WORKSPACE
): string {
  const normalized = normalizeSegment(workspace);
  if (normalized && WORKSPACE_SEGMENTS.has(normalized)) {
    return normalized;
  }
  return fallback;
}

export function buildWorkspacePath(
  business?: string | null,
  workspace?: string | null,
  path?: string | null
): string {
  const resolvedBusiness = resolveBusinessSegment(business, DEFAULT_BUSINESS);

  if (resolvedBusiness === 'personal') {
    return `/personal${normalizePath(path)}`;
  }

  const resolvedWorkspace = resolveWorkspaceSegment(
    workspace,
    DEFAULT_WORKSPACE
  );
  return `/${resolvedBusiness}/${resolvedWorkspace}${normalizePath(path)}`;
}

export function getMessagingPath(business?: string | null): string {
  const resolvedBusiness = resolveBusinessSegment(business, DEFAULT_BUSINESS);
  const messagingBusiness = MESSAGING_BUSINESSES.has(resolvedBusiness)
    ? resolvedBusiness
    : DEFAULT_BUSINESS;

  return buildWorkspacePath(messagingBusiness, 'operations', 'messaging');
}
