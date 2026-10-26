import { detectAccountType } from './account-classification';
import type { ManualJournalLine } from './data-fetchers';

export function projectProfitLossJournalLine(line: ManualJournalLine) {
  const category = line.account.trim();
  if (!category || detectAccountType(category)) {
    return null;
  }
  const type = /revenue|income|forfeited deposits|sales returns/i.test(category)
    ? ('Revenue' as const)
    : ('Expense' as const);
  const amount =
    type === 'Revenue' ? line.credit - line.debit : line.debit - line.credit;
  return Number.isFinite(amount) && amount !== 0
    ? { category, type, amount }
    : null;
}
