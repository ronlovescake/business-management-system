import { useEffect } from 'react';

function findFocusableElement(selector: string): HTMLElement | null {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const isVisible =
      element.offsetParent !== null || element.getClientRects().length > 0;

    if (isVisible) {
      return element;
    }
  }

  return null;
}

export function useCtrlFFocus(selector: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key.toLowerCase() !== 'f') {
        return;
      }

      const target = findFocusableElement(selector);

      if (!target) {
        return;
      }

      event.preventDefault();

      window.requestAnimationFrame(() => {
        if (typeof (target as HTMLElement).focus === 'function') {
          (target as HTMLElement).focus({ preventScroll: true });
        }

        if (
          'select' in target &&
          typeof (target as HTMLInputElement | HTMLTextAreaElement).select ===
            'function'
        ) {
          (target as HTMLInputElement | HTMLTextAreaElement).select();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selector, enabled]);
}
