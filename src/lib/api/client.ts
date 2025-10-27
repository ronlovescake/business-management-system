/**
 * Centralized API Client
 *
 * A robust HTTP client for making API requests with:
 * - Automatic retry logic with exponential backoff
 * - Request/response interceptors
 * - Timeout configuration
 * - Request cancellation support
 * - Authentication header injection (ready for auth)
 * - Error transformation and handling
 * - Request/response logging
 *
 * @example
 * ```ts
 * import { apiClient } from '@/lib/api/client';
 *
 * // GET request
 * const users = await apiClient.get('/users');
 *
 * // POST request
 * const newUser = await apiClient.post('/users', { name: 'John' });
 *
 * // With options
 * const data = await apiClient.get('/data', { timeout: 5000, retry: 3 });
 * ```
 */

import { logger } from '@/lib/logger';
import {
  DEFAULT_API_TIMEOUT,
  RETRY_BASE_DELAY,
  MAX_RETRY_DELAY,
} from '@/constants/timeouts';

/**
 * API Error class with additional context
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown,
    public url?: string
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

/**
 * Network Error class for connection issues
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout Error class
 */
export class TimeoutError extends Error {
  constructor(
    public timeout: number,
    public url: string
  ) {
    super(`Request timeout after ${timeout}ms: ${url}`);
    this.name = 'TimeoutError';
  }
}

/**
 * Request options
 */
export interface RequestOptions extends RequestInit {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retry?: number;
  /** Whether to retry on failure (default: true) */
  retryEnabled?: boolean;
  /** Custom retry delay in milliseconds */
  retryDelay?: number;
  /** Skip authentication header injection */
  skipAuth?: boolean;
  /** Additional context for logging */
  context?: Record<string, unknown>;
}

/**
 * Response interceptor function
 */
export type ResponseInterceptor = (
  response: Response
) => Response | Promise<Response>;

/**
 * Request interceptor function
 */
export type RequestInterceptor = (
  url: string,
  options: RequestOptions
) =>
  | { url: string; options: RequestOptions }
  | Promise<{ url: string; options: RequestOptions }>;

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseURL?: string;
  defaultTimeout?: number;
  defaultRetry?: number;
  headers?: Record<string, string>;
}

/**
 * Centralized API Client
 */
export class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;
  private defaultRetry: number;
  private defaultHeaders: Record<string, string>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: ApiClientConfig = {}) {
    this.baseURL = config.baseURL || '';
    this.defaultTimeout = config.defaultTimeout || DEFAULT_API_TIMEOUT;
    this.defaultRetry = config.defaultRetry || 3;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Clear all interceptors
   */
  clearInterceptors(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestOptions,
    attempt = 1
  ): Promise<T> {
    const maxRetries =
      options.retryEnabled === false ? 1 : (options.retry ?? this.defaultRetry);

    try {
      return await this.executeRequest<T>(url, options);
    } catch (error) {
      // Don't retry on certain errors
      if (error instanceof ApiError && error.status < 500) {
        throw error; // Client errors (4xx) shouldn't be retried
      }

      if (error instanceof TimeoutError && attempt < maxRetries) {
        const delay = this.calculateRetryDelay(attempt, options.retryDelay);
        logger.warn(
          `Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
          { url, error: error.message }
        );

        await this.sleep(delay);
        return this.executeWithRetry<T>(url, options, attempt + 1);
      }

      if (attempt < maxRetries) {
        const delay = this.calculateRetryDelay(attempt, options.retryDelay);
        logger.warn(
          `Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
          {
            url,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );

        await this.sleep(delay);
        return this.executeWithRetry<T>(url, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, customDelay?: number): number {
    if (customDelay) {
      return customDelay;
    }

    const exponentialDelay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add random jitter
    return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute single request
   */
  private async executeRequest<T>(
    url: string,
    options: RequestOptions
  ): Promise<T> {
    // Apply request interceptors
    let interceptedUrl = url;
    let interceptedOptions = options;

    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(interceptedUrl, interceptedOptions);
      interceptedUrl = result.url;
      interceptedOptions = result.options;
    }

    const fullURL = interceptedUrl.startsWith('http')
      ? interceptedUrl
      : `${this.baseURL}${interceptedUrl}`;

    const timeout = interceptedOptions.timeout ?? this.defaultTimeout;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = {
        ...this.defaultHeaders,
        ...interceptedOptions.headers,
      };

      // FUTURE: Add authentication header when auth is implemented
      // if (!interceptedOptions.skipAuth && authToken) {
      //   headers['Authorization'] = `Bearer ${authToken}`;
      // }

      logger.debug('API Request:', {
        method: interceptedOptions.method || 'GET',
        url: fullURL,
        context: interceptedOptions.context,
      });

      let response = await fetch(fullURL, {
        ...interceptedOptions,
        headers,
        signal: interceptedOptions.signal || controller.signal,
      });

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {
          // Response body is not valid JSON or empty
        }
        throw new ApiError(
          response.status,
          response.statusText,
          errorData,
          fullURL
        );
      }

      // Handle different content types
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      } else if (contentType?.includes('text/')) {
        return response.text() as T;
      } else if (
        contentType?.includes('application/pdf') ||
        contentType?.includes('blob')
      ) {
        return response.blob() as T;
      } else {
        return response.json(); // Default to JSON
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        logger.error('API Error:', {
          status: error.status,
          url: error.url,
          data: error.data,
        });
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError(timeout, fullURL);
      }

      // Network errors
      logger.error('Network Error:', {
        url: fullURL,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new NetworkError(
        `Failed to fetch: ${fullURL}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.executeWithRetry<T>(url, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.executeWithRetry<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.executeWithRetry<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.executeWithRetry<T>(url, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    return this.executeWithRetry<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient({
  baseURL: '',
  defaultTimeout: DEFAULT_API_TIMEOUT,
  defaultRetry: 3,
});

/**
 * Convenience exports for common patterns
 */
export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    apiClient.get<T>(url, options),
  post: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    apiClient.post<T>(url, data, options),
  put: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    apiClient.put<T>(url, data, options),
  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    apiClient.delete<T>(url, options),
  patch: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    apiClient.patch<T>(url, data, options),
};
