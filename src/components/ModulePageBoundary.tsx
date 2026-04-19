'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { logger } from '@/lib/logger';

export interface ModulePageBoundaryProps {
  children: ReactNode;
  /** Stable identifier for the module (e.g. `clothing/operations/products`). */
  moduleId: string;
  /** Domain bucket; appears as a Sentry tag. */
  domain?:
    | 'clothing'
    | 'general-merchandise'
    | 'trucking'
    | 'household'
    | 'platform'
    | 'shared';
  /** Optional override for the rendered fallback UI. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ModulePageBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Module-scoped error boundary. Wrap each module page (or any large
 * sub-tree) so a thrown error in one module does not crash the whole app
 * and so Sentry receives module/domain context.
 *
 * Usage in a page:
 *
 *   export default function Page() {
 *     return (
 *       <ModulePageBoundary moduleId="clothing/operations/products" domain="clothing">
 *         <ProductsPage />
 *       </ModulePageBoundary>
 *     );
 *   }
 */
export class ModulePageBoundary extends Component<
  ModulePageBoundaryProps,
  ModulePageBoundaryState
> {
  constructor(props: ModulePageBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModulePageBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { moduleId, domain } = this.props;
    logger.error(
      `[ModulePageBoundary] ${moduleId} (${domain ?? 'unknown'}) crashed:`,
      error,
      errorInfo
    );

    // Best-effort Sentry tagging. Imported dynamically to keep this file
    // SSR-friendly and to avoid pulling Sentry into bundles where it is not
    // already present.
    if (typeof window !== 'undefined') {
      void import('@sentry/nextjs')
        .then((Sentry) => {
          Sentry.withScope((scope) => {
            scope.setTag('module', moduleId);
            if (domain) {
              scope.setTag('domain', domain);
            }
            scope.setContext('react', {
              componentStack: errorInfo.componentStack,
            });
            Sentry.captureException(error);
          });
        })
        .catch(() => {
          // Sentry not available in this environment; logger.error already
          // captured the failure.
        });
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
      });
    }

    return (
      <div
        role="alert"
        style={{
          padding: '24px',
          margin: '16px',
          border: '1px solid #f1c40f',
          borderRadius: '8px',
          background: '#fff8e1',
          color: '#5b4a00',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>
          {this.props.moduleId} encountered an error
        </div>
        <div style={{ fontSize: '14px', marginBottom: '12px' }}>
          {this.state.error.message ||
            'An unexpected error happened while rendering this section.'}
        </div>
        <button
          type="button"
          onClick={this.reset}
          style={{
            padding: '6px 12px',
            border: '1px solid #5b4a00',
            background: 'transparent',
            color: '#5b4a00',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ModulePageBoundary;
