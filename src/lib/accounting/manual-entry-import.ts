import { parseCsvAmount, parseCsvDateToISO, parseCsvText } from './csv-import';

export type ManualEntryImportRow = {
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description?: string;
};

const REQUIRED_COLUMNS = [
  'date',
  'amount',
  'ref',
  'debitaccount',
  'creditaccount',
] as const;

export function parseManualEntryCsv(text: string): {
  rows: ManualEntryImportRow[];
  errors: string[];
} {
  const parsed = parseCsvText(text);
  const missing = REQUIRED_COLUMNS.filter(
    (col) => !parsed.headers.includes(col)
  );

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { rows: [], errors: ['CSV file is empty or invalid.'] };
  }

  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `Missing required columns: ${missing.join(', ')}. Required columns: ${REQUIRED_COLUMNS.join(
          ', '
        )}.`,
      ],
    };
  }

  const errors: string[] = [];
  const rows: ManualEntryImportRow[] = [];

  parsed.rows.forEach((row, index) => {
    const line = index + 2;
    if (!row.date && !row.amount && !row.description && !row.ref) {
      return;
    }

    const amount = parseCsvAmount(row.amount || '');
    if (amount === null) {
      errors.push(`Row ${line}: Invalid amount "${row.amount}"`);
      return;
    }

    const date = parseCsvDateToISO(row.date || '');
    if (!date) {
      errors.push(`Row ${line}: Invalid date "${row.date}"`);
      return;
    }

    const debitAccount = (row.debitaccount || '').trim();
    const creditAccount = (row.creditaccount || '').trim();
    if (!debitAccount || !creditAccount) {
      errors.push(`Row ${line}: Missing debit or credit account`);
      return;
    }

    const ref = (row.ref || '').trim();
    if (!ref) {
      errors.push(`Row ${line}: Missing reference`);
      return;
    }

    const description = (row.description || '').trim();

    rows.push({
      date,
      ref,
      debitAccount,
      creditAccount,
      amount,
      description,
    });
  });

  return { rows, errors };
}
