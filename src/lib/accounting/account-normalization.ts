/**
 * Normalizes account names for simplified reporting.
 *
 * For this project, we treat Bank + GCash/E-Wallet balances as cash equivalents.
 * This keeps reporting consistent with sales/expense entries that already post
 * to `Cash`.
 */
export function normalizeAccountForReporting(account: string): string {
  const trimmed = (account ?? '').trim();
  if (!trimmed) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase();

  if (normalized.startsWith('loan payable')) {
    return trimmed;
  }

  // Treat bank + e-wallet (e.g., GCash) as cash equivalents.
  if (
    normalized === 'bank' ||
    normalized === 'e-wallet' ||
    normalized === 'e wallet' ||
    normalized.includes('gcash')
  ) {
    return 'Cash';
  }

  return trimmed;
}
