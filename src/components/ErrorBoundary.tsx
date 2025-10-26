'use client';

import { Component } from 'react';
import type { ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 *
 * Catches unhandled errors in React component tree and displays
 * a user-friendly error UI instead of crashing the entire app.
 *
 * Note: Error fallback UI uses plain HTML/CSS to avoid dependency
 * on Mantine context which may be unavailable after error.
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourApp />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    logger.error('ErrorBoundary caught an error:', error);
    logger.error('Error Info:', errorInfo);

    this.setState({
      errorInfo,
    });

    // REQUIRES: Error reporting service (Sentry/LogRocket)
    // Deferred until P1 Task #2 (Setup Sentry) is complete
    // Example implementation:
    // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI using plain HTML/CSS (no Mantine dependencies)
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '20px',
            backgroundColor: '#f8f9fa',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '32px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #dee2e6',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              {/* Alert Icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  backgroundColor: '#fff5f5',
                  color: '#fa5252',
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>

              {/* Title */}
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: '#212529',
                  marginBottom: '12px',
                  marginTop: 0,
                }}
              >
                Oops! Something went wrong
              </h2>

              {/* Error message */}
              <p
                style={{
                  fontSize: '14px',
                  color: '#868e96',
                  marginBottom: '24px',
                }}
              >
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>

              {/* Error details (development only) */}
              {process.env.NODE_ENV === 'development' &&
                this.state.errorInfo && (
                  <div
                    style={{
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      padding: '16px',
                      marginBottom: '24px',
                      maxHeight: '200px',
                      overflow: 'auto',
                      textAlign: 'left',
                    }}
                  >
                    <pre
                      style={{
                        fontSize: '11px',
                        color: '#495057',
                        margin: 0,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <button
                  onClick={this.handleReload}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'white',
                    backgroundColor: '#228be6',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor = '#1c7ed6')
                  }
                  onFocus={(e) =>
                    (e.currentTarget.style.backgroundColor = '#1c7ed6')
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor = '#228be6')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.backgroundColor = '#228be6')
                  }
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Reload Page
                </button>

                <button
                  onClick={this.handleReset}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#228be6',
                    backgroundColor: 'transparent',
                    border: '1px solid #228be6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#e7f5ff';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.backgroundColor = '#e7f5ff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Try Again
                </button>
              </div>

              {/* Support text */}
              <p
                style={{
                  fontSize: '12px',
                  color: '#adb5bd',
                  marginTop: '24px',
                  marginBottom: 0,
                }}
              >
                If this problem persists, please contact support
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
