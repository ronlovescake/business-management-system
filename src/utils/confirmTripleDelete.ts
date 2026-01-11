import Swal from 'sweetalert2';

export interface ConfirmTripleDeleteOptions {
  title?: string;
  warning?: string;
  secondaryWarning?: string;
  finalPrompt?: string;
  confirmWord?: string;
}

const DEFAULTS: Required<ConfirmTripleDeleteOptions> = {
  title: 'Delete item?',
  warning: 'This will permanently delete this item.',
  secondaryWarning: 'Are you absolutely sure?',
  finalPrompt: 'Type DELETE to confirm.',
  confirmWord: 'DELETE',
};

/**
 * Three-step destructive confirmation flow shared across pages.
 */
export async function confirmTripleDelete(
  options: ConfirmTripleDeleteOptions = {}
): Promise<boolean> {
  const { title, warning, secondaryWarning, finalPrompt, confirmWord } = {
    ...DEFAULTS,
    ...options,
  };

  const step1 = await Swal.fire({
    title,
    text: warning,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Continue',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
  });

  if (!step1.isConfirmed) {
    return false;
  }

  const step2 = await Swal.fire({
    title: 'Are you absolutely sure?',
    text: secondaryWarning,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, continue',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
  });

  if (!step2.isConfirmed) {
    return false;
  }

  const step3 = await Swal.fire({
    title: 'Final confirmation',
    text: finalPrompt,
    icon: 'warning',
    input: 'text',
    inputPlaceholder: confirmWord,
    inputAttributes: { autocapitalize: 'off' },
    showCancelButton: true,
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
    inputValidator: (value) => {
      if ((value || '').trim().toUpperCase() !== confirmWord.toUpperCase()) {
        return `Please type ${confirmWord} to confirm.`;
      }
      return undefined;
    },
  });

  return step3.isConfirmed;
}
