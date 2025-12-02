/**
 * API Types
 *
 * Standardized types for API requests and responses using discriminated unions
 * for type-safe state management.
 */

/**
 * Discriminated union for async data loading states
 *
 * Usage:
 * ```typescript
 * const [state, setState] = useState<AsyncData<User[]>>({ status: 'idle' });
 *
 * if (state.status === 'success') {
 *   // TypeScript knows state.data exists here
 *   console.log(state.data);
 * }
 * ```
 */
export type AsyncData<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

/**
 * Discriminated union for form states
 */
export type FormState<T> =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; data: T }
  | {
      status: 'error';
      error: string;
      validationErrors?: Record<string, string>;
    };

/**
 * Standard API Response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated API Response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string;
  field?: string;
  validationErrors?: Record<string, string>;
  suggestion?: string;
  meta?: Record<string, unknown>;
}

/**
 * Batch operation response
 */
export interface BatchOperationResponse {
  success: boolean;
  count: number;
  message: string;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Helper type for API route handlers
 */
export type ApiRouteHandler = (
  request: Request
) => Promise<Response> | Response;

/**
 * Type guards for discriminated unions
 */
export const AsyncData = {
  isIdle: <T>(state: AsyncData<T>): state is { status: 'idle' } =>
    state.status === 'idle',

  isLoading: <T>(state: AsyncData<T>): state is { status: 'loading' } =>
    state.status === 'loading',

  isSuccess: <T>(
    state: AsyncData<T>
  ): state is { status: 'success'; data: T } => state.status === 'success',

  isError: <T>(
    state: AsyncData<T>
  ): state is { status: 'error'; error: Error } => state.status === 'error',
};

export const FormState = {
  isIdle: <T>(state: FormState<T>): state is { status: 'idle' } =>
    state.status === 'idle',

  isSubmitting: <T>(state: FormState<T>): state is { status: 'submitting' } =>
    state.status === 'submitting',

  isSuccess: <T>(
    state: FormState<T>
  ): state is { status: 'success'; data: T } => state.status === 'success',

  isError: <T>(
    state: FormState<T>
  ): state is { status: 'error'; error: string } => state.status === 'error',
};
