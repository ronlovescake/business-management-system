export const HANDBOOK_PATH = '/clothing/operations/handbook';

export const HANDBOOK_MODULES = [
  { id: 'getting-started', label: 'Getting Started', group: 'Operations' },
  { id: 'products', label: 'Products', group: 'Operations' },
  { id: 'transactions', label: 'Transactions', group: 'Operations' },
  { id: 'customers', label: 'Customers', group: 'Operations' },
  { id: 'inventory', label: 'Inventory', group: 'Operations' },
  { id: 'prices', label: 'Prices', group: 'Operations' },
  {
    id: 'sorting-distribution',
    label: 'Sorting & Distribution',
    group: 'Operations',
  },
  { id: 'shipments', label: 'Shipments', group: 'Operations' },
  { id: 'invoicing', label: 'Invoicing & Checkout Links', group: 'Operations' },
  { id: 'dispatch', label: 'Dispatch', group: 'Operations' },
  { id: 'due-dates', label: 'Due Dates', group: 'Operations' },
  { id: 'accounting-dashboard', label: 'Dashboard', group: 'Accounting' },
  { id: 'expenses', label: 'Expenses', group: 'Accounting' },
  { id: 'journal', label: 'Journal', group: 'Accounting' },
  { id: 'ledger', label: 'Ledger', group: 'Accounting' },
  { id: 'balance-sheet', label: 'Balance Sheet', group: 'Accounting' },
  { id: 'profit-loss', label: 'Profit & Loss', group: 'Accounting' },
] as const;

export type HandbookModuleId = (typeof HANDBOOK_MODULES)[number]['id'];
export type HandbookKind = 'workflow' | 'issue' | 'reference' | 'accounting';

export interface HandbookProcedure {
  id: string;
  title: string;
  modules: HandbookModuleId[];
  kind: HandbookKind;
  html: string;
  searchText: string;
}

export function searchHandbook(
  procedures: HandbookProcedure[],
  query: string,
  moduleId?: HandbookModuleId
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  return procedures.filter(
    (procedure) =>
      (!moduleId || procedure.modules.includes(moduleId)) &&
      terms.every((term) => procedure.searchText.includes(term))
  );
}
