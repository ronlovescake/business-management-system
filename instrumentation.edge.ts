let initialized = false;

export function register(): Promise<void> | void {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  if (initialized || !sentryDsn) {
    return;
  }

  initialized = true;

  return import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 1,
      debug: false,
    });
  });
}
