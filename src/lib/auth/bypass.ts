/**
 * Centralized helper for the `BYPASS_AUTH_FOR_TESTS` test-only escape hatch.
 *
 * Background:
 *   This flag exists to let Playwright/integration tests run protected pages
 *   and APIs without going through real NextAuth credential flows. It MUST
 *   never be enabled in production. Treat it as test scaffolding only.
 *
 * Why a single helper:
 *   The bypass was previously read inline in `src/middleware.ts` and
 *   `src/lib/auth/permissions.ts` (and could easily drift to other call
 *   sites). Centralizing the read gives us:
 *     1. A single, audit-grep-able call site (`isAuthBypassed`)
 *     2. Consistent boolean parsing (case-insensitive, trimmed)
 *     3. A consistent prod-safety guard (`assertBypassNotInProduction`)
 *     4. A single place to add telemetry/logging when bypass is active
 *
 * NOTE: Do NOT add any new logic that *grants* permissions when bypass is on
 * beyond what middleware/permission helpers already do today. The helper is
 * intentionally minimal.
 */

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

/**
 * Returns true if `BYPASS_AUTH_FOR_TESTS` is set to a truthy value
 * (`true`, `1`, `yes`, `on`, case-insensitive). Empty/unset returns false.
 *
 * Safe to call from any runtime (edge, node, browser-server). Reads
 * `process.env` only, never mutates it.
 */
export function isAuthBypassed(): boolean {
  const raw = (process.env.BYPASS_AUTH_FOR_TESTS ?? '').trim().toLowerCase();
  return TRUTHY.has(raw);
}

/**
 * Hard guard: throws if the bypass flag is on while NODE_ENV === 'production'.
 *
 * Call this from any auth-sensitive bootstrap path (e.g. server startup,
 * deployed health check) so we fail loudly rather than silently letting an
 * unauthenticated request through in prod.
 *
 * NOT called automatically \u2014 callers opt in. This keeps unit tests free
 * to set the flag without tripping the guard.
 */
export function assertBypassNotInProduction(): void {
  if (process.env.NODE_ENV === 'production' && isAuthBypassed()) {
    throw new Error(
      'BYPASS_AUTH_FOR_TESTS is enabled in a production NODE_ENV. This flag ' +
        'is for tests only and must never be set in production deployments.'
    );
  }
}
