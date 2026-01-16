import { toTaggableSelection } from './account-tagging';

export const MANUAL_ENTRY_DEFAULT_DATE = '2026-01-01';

export type ManualEntryFormState = {
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  debitAccountTag: string;
  creditAccountTag: string;
  amount: number;
  description: string;
};

export type ManualEntryLine = {
  date: string;
  ref?: string | null;
  account: string;
  debit?: number | null;
  credit?: number | null;
  description?: string | null;
};

export function createManualEntryFormState(
  date: string = MANUAL_ENTRY_DEFAULT_DATE
): ManualEntryFormState {
  return {
    date,
    ref: '',
    debitAccount: '',
    creditAccount: '',
    debitAccountTag: '',
    creditAccountTag: '',
    amount: 0,
    description: '',
  };
}

export function buildManualEntryFormFromLines(
  debitLine: ManualEntryLine,
  creditLine: ManualEntryLine
): ManualEntryFormState {
  const debitSelection = toTaggableSelection(debitLine.account);
  const creditSelection = toTaggableSelection(creditLine.account);

  return {
    date: (debitLine.date || creditLine.date).slice(0, 10),
    ref: debitLine.ref || creditLine.ref || '',
    debitAccount: debitSelection.account,
    creditAccount: creditSelection.account,
    debitAccountTag: debitSelection.tag,
    creditAccountTag: creditSelection.tag,
    amount: Number(debitLine.debit ?? creditLine.credit ?? 0),
    description: debitLine.description || creditLine.description || '',
  };
}
