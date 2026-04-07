export function getAccountingLoadErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }

  if (typeof error === 'string') {
    const message = error.trim();
    if (message) {
      return message;
    }
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim() !== ''
  ) {
    return error.message.trim();
  }

  return fallback;
}
