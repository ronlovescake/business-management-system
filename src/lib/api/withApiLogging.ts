/**
 * API route logging + error normalization wrapper.
 *
 * Wraps a Next.js App Router route handler so that:
 *   - every request emits a structured log line (method, path, status, duration)
 *   - uncaught exceptions are converted to a standard error envelope
 *   - errors are forwarded to Sentry with route/module context
 *
 * Usage in `src/app/api/<route>/route.ts`:
 *
 *   import { withApiLogging } from '@/lib/api/withApiLogging';
 *
 *   export const GET = withApiLogging(async (request) => {
 *     // your handler
 *     return NextResponse.json({ success: true, data: ... });
 *   }, { route: '/api/things' });
 *
 * The wrapper is intentionally lightweight: it does not enforce auth, it does
 * not parse the body, and it does not inject pagination. Compose it with
 * other helpers (`paginationFor`, Zod schemas, auth guards) as needed.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export interface ApiLoggingOptions {
  /** Stable route identifier for logs and Sentry tags (e.g. `/api/products`). */
  route: string;
  /** Optional module/domain context (e.g. `clothing/operations/products`). */
  module?: string;
  domain?:
    | 'clothing'
    | 'general-merchandise'
    | 'trucking'
    | 'household'
    | 'platform'
    | 'shared';
}

type RouteHandler<TContext = unknown> = (
  request: NextRequest,
  context: TContext
) => Promise<Response> | Response;

/**
 * Wrap an App Router route handler with structured logging + error
 * normalization. Returns a handler with the same call signature.
 */
export function withApiLogging<TContext = unknown>(
  handler: RouteHandler<TContext>,
  options: ApiLoggingOptions
): RouteHandler<TContext> {
  return async function wrappedRouteHandler(request, context) {
    const start = Date.now();
    const method = request.method ?? 'GET';
    const url = safeUrl(request.url);
    const path = url?.pathname ?? options.route;

    try {
      const response = await handler(request, context);
      const duration = Date.now() - start;
      logger.debug(
        'api',
        `${method} ${path} -> ${response.status} (${duration}ms)`
      );
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`[api] ${method} ${path} threw after ${duration}ms`, error);

      // Best-effort Sentry tagging.
      void reportToSentry(error, {
        route: options.route,
        module: options.module,
        domain: options.domain,
        method,
        path,
      });

      const message =
        error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          details: process.env.NODE_ENV === 'development' ? message : undefined,
        },
        { status: 500 }
      );
    }
  };
}

function safeUrl(url: string | undefined): URL | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url, 'http://x');
  } catch {
    return null;
  }
}

async function reportToSentry(
  error: unknown,
  ctx: {
    route: string;
    module?: string;
    domain?: string;
    method: string;
    path: string;
  }
): Promise<void> {
  if (typeof window !== 'undefined') {
    return; // route handlers run server-side
  }
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.withScope((scope) => {
      scope.setTag('route', ctx.route);
      scope.setTag('http.method', ctx.method);
      if (ctx.module) {
        scope.setTag('module', ctx.module);
      }
      if (ctx.domain) {
        scope.setTag('domain', ctx.domain);
      }
      scope.setContext('http', { method: ctx.method, path: ctx.path });
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), 'error');
      }
    });
  } catch {
    // Sentry not installed in this environment; logger.error already covered it.
  }
}
