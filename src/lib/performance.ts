/**
 * Performance utility functions for optimizing React applications
 */

/**
 * Throttle function - limits how often a function can be called
 * Perfect for resize/scroll events
 *
 * @param fn - Function to throttle
 * @param delay - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // Clear any pending timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (timeSinceLastCall >= delay) {
      // Enough time has passed, call immediately
      lastCall = now;
      fn(...args);
    } else {
      // Schedule a call for later
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function - delays function execution until after wait time has elapsed
 * Perfect for search inputs
 *
 * @param fn - Function to debounce
 * @param delay - Time to wait in milliseconds
 * @returns Debounced function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Creates a memoized function that caches results based on first argument
 * Perfect for expensive computations with repeated inputs
 *
 * @param fn - Function to memoize
 * @param maxCacheSize - Maximum number of cached results (default: 100)
 * @returns Memoized function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memoize<
  T extends (key: string | number, ...args: any[]) => any,
>(fn: T, maxCacheSize = 100): T {
  const cache = new Map<string | number, ReturnType<T>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function memoized(
    key: string | number,
    ...args: any[]
  ): ReturnType<T> {
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(key, ...args);
    cache.set(key, result);

    // Limit cache size to prevent memory leaks
    if (cache.size > maxCacheSize) {
      const firstKey = cache.keys().next().value as string | number;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    return result;
  } as T;
}

/**
 * Request animation frame throttle - syncs with browser's repaint
 * Perfect for scroll/animation events
 *
 * @param fn - Function to throttle
 * @returns RAF-throttled function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let latestArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>) {
    latestArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (latestArgs) {
          fn(...latestArgs);
        }
        rafId = null;
        latestArgs = null;
      });
    }
  };
}
