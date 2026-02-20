/**
 * Performance utility functions for optimizing React applications
 */

/**
 * Throttle function - limits function calls to once per delay period
 * Perfect for scroll/resize handlers
 *
 * @param fn - Function to throttle
 * @param delay - Time to wait between calls in milliseconds
 * @returns Throttled function with cleanup method
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCall = 0;

  const throttled = function (...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // Clear any pending timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
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
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };

  // Add cancel method for cleanup
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return throttled;
}

/**
 * Debounce function - delays function execution until after wait time has elapsed
 * Perfect for search inputs
 *
 * @param fn - Function to debounce
 * @param delay - Time to wait in milliseconds
 * @returns Debounced function with cleanup method
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  // Add cancel method for cleanup
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a memoized function that caches results based on first argument
 * Perfect for expensive computations with repeated inputs
 *
 * @param fn - Function to memoize
 * @param maxCacheSize - Maximum number of cached results (default: 100)
 * @returns Memoized function
 */
export function memoize<K extends string | number, Args extends unknown[], R>(
  fn: (key: K, ...args: Args) => R,
  maxCacheSize = 100
): (key: K, ...args: Args) => R {
  const cache = new Map<K, R>();

  return function memoized(key: K, ...args: Args): R {
    const cachedResult = cache.get(key);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const result = fn(key, ...args);
    cache.set(key, result);

    // Limit cache size to prevent memory leaks
    if (cache.size > maxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    return result;
  };
}

/**
 * Request animation frame throttle - syncs with browser's repaint
 * Perfect for scroll/animation events
 *
 * @param fn - Function to throttle
 * @returns RAF-throttled function with cleanup method
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let rafId: number | null = null;
  let latestArgs: Parameters<T> | null = null;

  const throttled = function (...args: Parameters<T>) {
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

  // Add cancel method for cleanup
  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      latestArgs = null;
    }
  };

  return throttled;
}
