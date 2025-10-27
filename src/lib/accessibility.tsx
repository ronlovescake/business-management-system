/**
 * Accessibility Utilities
 * 
 * Helper functions and components for improving accessibility
 */

import React from 'react';

// ============================================================================
// SCREEN READER UTILITIES
// ============================================================================

/**
 * Screen reader only text component
 * Visually hidden but available to screen readers
 * 
 * Usage:
 * ```tsx
 * <ScreenReaderOnly>Loading data...</ScreenReaderOnly>
 * ```
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Accessible loading indicator
 * Announces loading state to screen readers
 * 
 * Usage:
 * ```tsx
 * {isLoading && <AccessibleLoader message="Loading customers..." />}
 * ```
 */
export function AccessibleLoader({
  message = 'Loading...',
  size: _size = 'md', // Reserved for future use
}: {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div 
      role="status" 
      aria-live="polite" 
      aria-busy="true"
      style={{ textAlign: 'center', padding: '2rem' }}
    >
      {/* Visual loader would go here - using Mantine Loader */}
      <ScreenReaderOnly>{message}</ScreenReaderOnly>
    </div>
  );
}

// ============================================================================
// ARIA LABEL HELPERS
// ============================================================================

/**
 * Generate accessible label for action buttons
 * 
 * Usage:
 * ```tsx
 * <ActionIcon {...getActionLabel('Delete', 'customer', customerName)}>
 *   <IconTrash />
 * </ActionIcon>
 * ```
 */
export function getActionLabel(
  action: string,
  resource: string,
  identifier?: string
): { 'aria-label': string } {
  const label = identifier 
    ? `${action} ${resource}: ${identifier}`
    : `${action} ${resource}`;
    
  return { 'aria-label': label };
}

/**
 * Generate accessible label for icon-only buttons
 * 
 * Usage:
 * ```tsx
 * <Button {...getIconButtonLabel('Add new customer')}>
 *   <IconPlus />
 * </Button>
 * ```
 */
export function getIconButtonLabel(label: string): { 'aria-label': string } {
  return { 'aria-label': label };
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Set focus to element by ID
 * Useful after route changes or modal closes
 * 
 * Usage:
 * ```tsx
 * focusElement('main-content');
 * ```
 */
export function focusElement(elementId: string, delay = 100) {
  setTimeout(() => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  }, delay);
}

/**
 * Set focus to first form error
 * Useful after form validation
 * 
 * Usage:
 * ```tsx
 * if (errors) {
 *   focusFirstError();
 * }
 * ```
 */
export function focusFirstError() {
  setTimeout(() => {
    const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement;
    if (firstError) {
      firstError.focus();
    }
  }, 100);
}

// ============================================================================
// LIVE REGION ANNOUNCER
// ============================================================================

let announcer: HTMLDivElement | null = null;

/**
 * Initialize the live region announcer
 * Call this once in your app's root
 */
export function initializeAnnouncer() {
  if (typeof window === 'undefined' || announcer) {
    return;
  }

  announcer = document.createElement('div');
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.style.position = 'absolute';
  announcer.style.left = '-10000px';
  announcer.style.width = '1px';
  announcer.style.height = '1px';
  announcer.style.overflow = 'hidden';
  
  document.body.appendChild(announcer);
}

/**
 * Announce a message to screen readers
 * 
 * Usage:
 * ```tsx
 * announce('Form submitted successfully');
 * announce('3 items added to cart', 'assertive');
 * ```
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (!announcer) {
    initializeAnnouncer();
  }

  if (announcer) {
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = '';
    
    // Small delay to ensure screen readers pick up the change
    setTimeout(() => {
      if (announcer) {
        announcer.textContent = message;
      }
    }, 100);
    
    // Clear after announcement
    setTimeout(() => {
      if (announcer) {
        announcer.textContent = '';
      }
    }, 1000);
  }
}

// ============================================================================
// KEYBOARD NAVIGATION HELPERS
// ============================================================================

/**
 * Handle keyboard navigation for custom components
 * 
 * Usage:
 * ```tsx
 * <div {...getKeyboardHandlers(handleClick)}>
 *   Custom clickable element
 * </div>
 * ```
 */
export function getKeyboardHandlers(onClick: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
  };
}

/**
 * Get ARIA attributes for data grid
 * 
 * Usage:
 * ```tsx
 * <div {...getGridAttributes(100)}>
 *   <DataEditor />
 * </div>
 * ```
 */
export function getGridAttributes(rowCount: number, colCount?: number) {
  return {
    role: 'grid',
    'aria-rowcount': rowCount,
    ...(colCount && { 'aria-colcount': colCount }),
  };
}

// ============================================================================
// FORM ACCESSIBILITY
// ============================================================================

/**
 * Get error announcement attributes
 * 
 * Usage:
 * ```tsx
 * <Input
 *   {...getErrorAttributes(errors.email)}
 *   {...form.getInputProps('email')}
 * />
 * ```
 */
export function getErrorAttributes(error?: string) {
  if (!error) {
    return {};
  }
  
  return {
    'aria-invalid': true,
    'aria-describedby': `error-${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * Get required field attributes
 * 
 * Usage:
 * ```tsx
 * <Input
 *   {...getRequiredAttributes()}
 *   label="Email"
 * />
 * ```
 */
export function getRequiredAttributes() {
  return {
    required: true,
    'aria-required': true,
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common ARIA labels for reuse
 */
export const ARIA_LABELS = {
  CLOSE: 'Close',
  MENU: 'Menu',
  SEARCH: 'Search',
  FILTER: 'Filter',
  SORT: 'Sort',
  PREVIOUS: 'Previous',
  NEXT: 'Next',
  FIRST: 'First',
  LAST: 'Last',
  EDIT: 'Edit',
  DELETE: 'Delete',
  ADD: 'Add',
  SAVE: 'Save',
  CANCEL: 'Cancel',
  LOADING: 'Loading',
  ERROR: 'Error',
  SUCCESS: 'Success',
  WARNING: 'Warning',
  INFO: 'Information',
} as const;

/**
 * Common keyboard keys
 */
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export type { };

// Re-export for convenience
export {
  ScreenReaderOnly as SR,
  AccessibleLoader as Loader,
};
