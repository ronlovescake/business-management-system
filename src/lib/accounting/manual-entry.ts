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

export type ManualEntryValidationError = {
  title: string;
  message: string;
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

export function validateManualEntryInput(input: {
  ref: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
}): ManualEntryValidationError | null {
  const ref = input.ref.trim();
  const debitAccount = input.debitAccount.trim();
  const creditAccount = input.creditAccount.trim();
  const amount = Number(input.amount ?? 0);

  if (!ref) {
    return {
      title: 'Reference is required',
      message: 'Add a short reference (e.g., PAYMENT • Customer Name).',
    };
  }

  if (!debitAccount || !creditAccount) {
    return {
      title: 'Accounts are required',
      message: 'Choose both a debit and credit account.',
    };
  }

  if (debitAccount === creditAccount) {
    return {
      title: 'Accounts must differ',
      message: 'Debit and credit accounts must be different.',
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      title: 'Amount must be positive',
      message: 'Enter a valid amount greater than 0.',
    };
  }

  return null;
}
