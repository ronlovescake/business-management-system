/**
 * SSR-Safe Browser API Utilities
 *
 * This module provides safe wrappers around browser APIs that may not be available
 * during Server-Side Rendering (SSR) in Next.js.
 *
 * @module utils/browser
 */

/**
 * Check if code is running in a browser environment
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Safely access window object
 * Returns undefined if not in browser environment
 */
export function getWindow(): Window | undefined {
  return isBrowser ? window : undefined;
}

/**
 * Safely access document object
 * Returns undefined if not in browser environment
 */
export function getDocument(): Document | undefined {
  return isBrowser ? document : undefined;
}

/**
 * Safely get window.innerHeight
 * Returns default value if not available
 */
export function getWindowHeight(defaultValue: number = 600): number {
  return isBrowser ? window.innerHeight : defaultValue;
}

/**
 * Safely get window.innerWidth
 * Returns default value if not available
 */
export function getWindowWidth(defaultValue: number = 1024): number {
  return isBrowser ? window.innerWidth : defaultValue;
}

/**
 * Safely add event listener to window
 */
export function addWindowEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => unknown,
  options?: boolean | AddEventListenerOptions
): void {
  if (isBrowser) {
    window.addEventListener(type, listener, options);
  }
}

/**
 * Safely remove event listener from window
 */
export function removeWindowEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => unknown,
  options?: boolean | EventListenerOptions
): void {
  if (isBrowser) {
    window.removeEventListener(type, listener, options);
  }
}

/**
 * Safely add event listener to document
 */
export function addDocumentEventListener<K extends keyof DocumentEventMap>(
  type: K,
  listener: (this: Document, ev: DocumentEventMap[K]) => unknown,
  options?: boolean | AddEventListenerOptions
): void {
  if (isBrowser) {
    document.addEventListener(type, listener, options);
  }
}

/**
 * Safely remove event listener from document
 */
export function removeDocumentEventListener<K extends keyof DocumentEventMap>(
  type: K,
  listener: (this: Document, ev: DocumentEventMap[K]) => unknown,
  options?: boolean | EventListenerOptions
): void {
  if (isBrowser) {
    document.removeEventListener(type, listener, options);
  }
}

/**
 * Safely get local storage
 * Returns null if not available
 */
export function getLocalStorageItem(key: string): string | null {
  if (!isBrowser) {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    // LocalStorage might be disabled or throw errors
    return null;
  }
}

/**
 * Safely set local storage
 * Returns true if successful, false otherwise
 */
export function setLocalStorageItem(key: string, value: string): boolean {
  if (!isBrowser) {
    return false;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // LocalStorage might be full or disabled
    return false;
  }
}

/**
 * Safely create a download link for a blob
 * Does nothing if not in browser environment
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (!isBrowser) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Safely show browser alert
 * Returns false if not in browser environment
 */
export function showAlert(message: string): boolean {
  if (!isBrowser) {
    return false;
  }
  alert(message);
  return true;
}

/**
 * Safely show browser confirm dialog
 * Returns false if not in browser environment
 */
export function showConfirm(message: string): boolean {
  if (!isBrowser) {
    return false;
  }
  return confirm(message);
}

/**
 * Safely reload the page
 * Does nothing if not in browser environment
 */
export function reloadPage(): void {
  if (isBrowser) {
    window.location.reload();
  }
}

/**
 * Safely dispatch a custom event on window
 * Does nothing if not in browser environment
 */
export function dispatchWindowEvent(eventName: string, detail?: unknown): void {
  if (isBrowser) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

/**
 * Hook-safe effect that only runs on the client
 * Use this when you need to access browser APIs in a React effect
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   safeClientEffect(() => {
 *     // This code only runs on the client
 *     console.log('Window height:', window.innerHeight);
 *   });
 * }, []);
 * ```
 */
export function safeClientEffect(
  callback: () => void | (() => void)
): void | (() => void) {
  if (isBrowser) {
    return callback();
  }
}

/**
 * Safely use requestIdleCallback
 * Falls back to setTimeout if not available
 */
export function safeRequestIdleCallback(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if (isBrowser && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  return setTimeout(callback, options?.timeout || 0) as unknown as number;
}

/**
 * Safely cancel idle callback
 */
export function safeCancelIdleCallback(id: number): void {
  if (isBrowser && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}
