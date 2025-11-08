'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '3rem',
          }}
        >
          <section style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
              Our team has been notified. You can try again or return later if
              the issue persists.
            </p>
            <div
              style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: 600,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                  color: '#1f2937',
                  cursor: 'pointer',
                }}
              >
                Go home
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
