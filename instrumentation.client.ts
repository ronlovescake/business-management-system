import * as Sentry from '@sentry/nextjs';
import { env } from './src/lib/env';

let initialized = false;

export function register(): void {
  if (initialized || !env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  initialized = true;

  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}
