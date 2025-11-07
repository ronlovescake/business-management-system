/**
 * Centralized Alert/Popup Utility
 *
 * This module provides a unified interface for all alerts, confirmations, and notifications
 * across the application using SweetAlert2 as the default popup library.
 *
 * @module lib/alerts
 */

import Swal from 'sweetalert2';
import type { SweetAlertOptions, SweetAlertResult } from 'sweetalert2';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'question';
  confirmButtonText?: string;
  timer?: number;
  showConfirmButton?: boolean;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  type?: 'warning' | 'question' | 'info';
  showCancelButton?: boolean;
}

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'center'
    | 'center-start'
    | 'center-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end';
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const defaultSwalConfig: SweetAlertOptions = {
  confirmButtonColor: '#228be6', // Mantine blue
  cancelButtonColor: '#fa5252', // Mantine red
  allowOutsideClick: false, // Prevent accidental dismissal
  customClass: {
    popup: 'swal-popup-custom',
    title: 'swal-title-custom',
    htmlContainer: 'swal-html-custom',
    confirmButton: 'swal-confirm-btn',
    cancelButton: 'swal-cancel-btn',
  },
};

// ============================================================================
// CORE ALERT FUNCTIONS
// ============================================================================

/**
 * Display a simple alert message
 * Replaces: window.alert(), alert()
 *
 * @example
 * await showAlert({ message: 'Operation completed!' });
 * await showAlert({ message: 'Error occurred', type: 'error' });
 */
export async function showAlert(options: AlertOptions): Promise<void> {
  const config: SweetAlertOptions = {
    ...defaultSwalConfig,
    title: options.title,
    text: options.message,
    icon: options.type || 'info',
    confirmButtonText: options.confirmButtonText || 'OK',
    timer: options.timer,
    showConfirmButton: options.showConfirmButton !== false,
  };

  await Swal.fire(config);
}

/**
 * Display a confirmation dialog
 * Replaces: window.confirm(), confirm()
 *
 * @example
 * const confirmed = await showConfirm({ message: 'Are you sure?' });
 * if (confirmed) { ... }
 */
export async function showConfirm(options: ConfirmOptions): Promise<boolean> {
  const config: SweetAlertOptions = {
    ...defaultSwalConfig,
    title: options.title || 'Confirm',
    text: options.message,
    icon: options.type || 'question',
    showCancelButton: options.showCancelButton !== false,
    confirmButtonText: options.confirmButtonText || 'Yes',
    cancelButtonText: options.cancelButtonText || 'No',
  };

  const result: SweetAlertResult = await Swal.fire(config);
  return result.isConfirmed;
}

/**
 * Display a toast notification (non-blocking)
 * Can be used as an alternative to Mantine notifications for consistency
 *
 * @example
 * showToast({ message: 'Saved successfully!', type: 'success' });
 */
export function showToast(options: ToastOptions): void {
  const Toast = Swal.mixin({
    toast: true,
    position: options.position || 'top-end',
    showConfirmButton: false,
    timer: options.duration || 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  Toast.fire({
    icon: options.type || 'success',
    title: options.message,
  });
}

// ============================================================================
// SPECIALIZED ALERT FUNCTIONS
// ============================================================================

/**
 * Display a success message
 *
 * @example
 * await showSuccess('Record saved successfully!');
 */
export async function showSuccess(
  message: string,
  title?: string
): Promise<void> {
  await showAlert({
    title: title || 'Success',
    message,
    type: 'success',
  });
}

/**
 * Display an error message
 *
 * @example
 * await showError('Failed to save record');
 */
export async function showError(
  message: string,
  title?: string
): Promise<void> {
  await showAlert({
    title: title || 'Error',
    message,
    type: 'error',
  });
}

/**
 * Display a warning message
 *
 * @example
 * await showWarning('This action cannot be undone');
 */
export async function showWarning(
  message: string,
  title?: string
): Promise<void> {
  await showAlert({
    title: title || 'Warning',
    message,
    type: 'warning',
  });
}

/**
 * Display an info message
 *
 * @example
 * await showInfo('No records found');
 */
export async function showInfo(message: string, title?: string): Promise<void> {
  await showAlert({
    title: title || 'Information',
    message,
    type: 'info',
  });
}

// ============================================================================
// COMMON CONFIRMATION DIALOGS
// ============================================================================

/**
 * Display a delete confirmation dialog
 *
 * @example
 * const confirmed = await showDeleteConfirm();
 * if (confirmed) { deleteRecord(); }
 */
export async function showDeleteConfirm(
  itemName?: string,
  customMessage?: string
): Promise<boolean> {
  const message =
    customMessage ||
    `Are you sure you want to delete ${itemName || 'this record'}? This action cannot be undone.`;

  return await showConfirm({
    title: 'Confirm Delete',
    message,
    type: 'warning',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
  });
}

/**
 * Display a save confirmation dialog
 *
 * @example
 * const confirmed = await showSaveConfirm();
 * if (confirmed) { saveRecord(); }
 */
export async function showSaveConfirm(
  customMessage?: string
): Promise<boolean> {
  const message = customMessage || 'Do you want to save these changes?';

  return await showConfirm({
    title: 'Save Changes',
    message,
    type: 'question',
    confirmButtonText: 'Save',
    cancelButtonText: 'Cancel',
  });
}

/**
 * Display a discard changes confirmation dialog
 *
 * @example
 * const confirmed = await showDiscardConfirm();
 * if (confirmed) { closeForm(); }
 */
export async function showDiscardConfirm(): Promise<boolean> {
  return await showConfirm({
    title: 'Discard Changes',
    message: 'You have unsaved changes. Are you sure you want to discard them?',
    type: 'warning',
    confirmButtonText: 'Discard',
    cancelButtonText: 'Keep Editing',
  });
}

// ============================================================================
// ADVANCED ALERT FUNCTIONS
// ============================================================================

/**
 * Display a loading alert (can be closed programmatically)
 *
 * @example
 * showLoading('Processing...');
 * // ... do async work
 * Swal.close();
 */
export function showLoading(message: string = 'Processing...'): void {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

/**
 * Close any currently open SweetAlert dialog
 */
export function closeAlert(): void {
  Swal.close();
}

/**
 * Display a custom SweetAlert dialog with full control
 * For advanced use cases where the helper functions aren't sufficient
 *
 * @example
 * const result = await showCustomAlert({
 *   title: 'Custom Dialog',
 *   html: '<b>Custom HTML content</b>',
 *   showCancelButton: true,
 * });
 */
export async function showCustomAlert(
  options: SweetAlertOptions
): Promise<SweetAlertResult> {
  return await Swal.fire({
    ...defaultSwalConfig,
    ...options,
  } as SweetAlertOptions);
}

// ============================================================================
// MIGRATION HELPERS (for replacing native alerts)
// ============================================================================

/**
 * Drop-in replacement for window.alert()
 * Use this to quickly replace existing alert() calls
 *
 * @example
 * // Before: alert('Hello');
 * // After:  alertReplace('Hello');
 */
export function alertReplace(message: string): void {
  void showAlert({ message });
}

/**
 * Drop-in replacement for window.confirm()
 * Use this to quickly replace existing confirm() calls
 *
 * @example
 * // Before: if (confirm('Are you sure?')) { ... }
 * // After:  confirmReplace('Are you sure?').then(result => { if (result) { ... } });
 */
export async function confirmReplace(message: string): Promise<boolean> {
  return await showConfirm({ message });
}

// ============================================================================
// EXPORTS
// ============================================================================

const alerts = {
  showAlert,
  showConfirm,
  showToast,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showDeleteConfirm,
  showSaveConfirm,
  showDiscardConfirm,
  showLoading,
  closeAlert,
  showCustomAlert,
  alertReplace,
  confirmReplace,
};

export default alerts;
