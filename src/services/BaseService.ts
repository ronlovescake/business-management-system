import { logger } from '@/lib/logger';
import { unwrapApiData } from '@/lib/api/normalize';

/**
 * Custom API Error Class
 * Provides structured error information for API failures
 */
export class APIError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly endpoint: string;
  public readonly method: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    status: number,
    statusText: string,
    endpoint: string,
    method: string
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.statusText = statusText;
    this.endpoint = endpoint;
    this.method = method;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  /**
   * Check if error is retryable (network errors or server errors)
   */
  isRetryable(): boolean {
    return this.isServerError() || this.status === 408 || this.status === 429;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    if (this.status === 401) {
      return 'Authentication required. Please log in again.';
    }
    if (this.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (this.status === 404) {
      return 'The requested resource was not found.';
    }
    if (this.status === 409) {
      return 'This operation conflicts with existing data.';
    }
    if (this.status === 422) {
      return 'Invalid data submitted. Please check your input.';
    }
    if (this.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (this.isServerError()) {
      return 'Server error. Please try again later.';
    }
    return this.message || 'An unexpected error occurred.';
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      endpoint: this.endpoint,
      method: this.method,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Base Service Class
 * Provides common HTTP operations for all services with retry logic and exponential backoff
 */
export class BaseService {
  protected static baseUrl = '/api';

  /**
   * Default retry configuration
   */
  protected static defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  };

  /**
   * Calculate exponential backoff delay
   */
  private static calculateBackoff(
    attempt: number,
    config: RetryConfig
  ): number {
    const delay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Enhanced request with retry logic and exponential backoff
   */
  protected static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RetryConfig = { ...this.defaultRetryConfig, ...retryConfig };

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const requestConfig = { ...defaultOptions, ...options };
    const method = requestConfig.method || 'GET';

    let lastError: APIError | Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestConfig);

        if (!response.ok) {
          // Try to surface server-provided error details to aid debugging client errors
          let errorPayload: unknown = null;
          try {
            const text = await response.text();
            errorPayload = text;
            // Attempt JSON parse for structured API responses
            errorPayload = JSON.parse(text);
          } catch {
            // ignore parse errors; keep text/raw
          }

          const apiError = new APIError(
            `HTTP Error: ${response.status} - ${response.statusText}`,
            response.status,
            response.statusText,
            endpoint,
            method
          );

          if (errorPayload) {
            // Attach payload for richer logging
            (apiError as unknown as { body?: unknown }).body = errorPayload;
          }

          // Don't retry client errors (except 408 Request Timeout and 429 Too Many Requests)
          if (apiError.isClientError() && !apiError.isRetryable()) {
            logger.error(
              `API Error [${method} ${endpoint}]:`,
              apiError.toJSON()
            );
            throw apiError;
          }

          // Check if we should retry
          if (attempt < config.maxRetries && apiError.isRetryable()) {
            const delay = this.calculateBackoff(attempt, config);
            logger.warn(
              `API Error [${method} ${endpoint}]: ${apiError.status}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${config.maxRetries})`
            );
            await this.sleep(delay);
            lastError = apiError;
            continue;
          }

          // Max retries reached
          logger.error(
            `API Error [${method} ${endpoint}]: Max retries reached`,
            apiError.toJSON()
          );
          throw apiError;
        }

        // Success - parse and return response
        const payload = await response.json();
        return unwrapApiData<T>(payload) as T;
      } catch (error) {
        // Handle network errors or JSON parsing errors
        if (error instanceof APIError) {
          throw error;
        }

        const networkError =
          error instanceof Error ? error : new Error(String(error));

        // Retry network errors
        if (attempt < config.maxRetries) {
          const delay = this.calculateBackoff(attempt, config);
          logger.warn(
            `Network Error [${method} ${endpoint}]: ${networkError.message}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${config.maxRetries})`
          );
          await this.sleep(delay);
          lastError = networkError;
          continue;
        }

        // Max retries reached
        logger.error(
          `Network Error [${method} ${endpoint}]: Max retries reached`,
          networkError
        );
        throw networkError;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw (
      lastError ||
      new Error(`Request failed after ${config.maxRetries} retries`)
    );
  }

  /**
   * GET request
   */
  protected static async get<T>(
    endpoint: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, retryConfig);
  }

  /**
   * POST request
   */
  protected static async post<T>(
    endpoint: string,
    data: unknown,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      retryConfig
    );
  }

  /**
   * PUT request
   */
  protected static async put<T>(
    endpoint: string,
    data: unknown,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      retryConfig
    );
  }

  /**
   * PATCH request
   */
  protected static async patch<T>(
    endpoint: string,
    data: unknown,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      retryConfig
    );
  }

  /**
   * DELETE request
   */
  protected static async delete<T>(
    endpoint: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, retryConfig);
  }

  /**
   * DELETE request with void return
   */
  protected static async deleteVoid(
    endpoint: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<void> {
    await this.request<void>(endpoint, { method: 'DELETE' }, retryConfig);
  }
}

/**
 * Generic CRUD Service Interface
 */
export interface CRUDService<T, CreateT = Partial<T>, UpdateT = Partial<T>> {
  getAll(): Promise<T[]>;
  getById(id: string | number): Promise<T>;
  create(data: CreateT): Promise<T>;
  update(id: string | number, data: UpdateT): Promise<T>;
  delete(id: string | number): Promise<void>;
  bulkCreate(data: CreateT[]): Promise<{ count: number }>;
  bulkUpdate(data: T[]): Promise<{ count: number }>;
  deleteAll(): Promise<{ count: number }>;
}
