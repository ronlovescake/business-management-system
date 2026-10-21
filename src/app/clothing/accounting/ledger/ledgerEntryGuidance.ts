import { collapseTaggableAccountsForOptions } from '@/lib/accounting/account-tagging';

export type ClothingEntryScenarioId =
  | 'loan-received'
  | 'loan-principal'
  | 'loan-interest'
  | 'owner-contribution'
  | 'owner-withdrawal'
  | 'supplier-inventory'
  | 'shipment-logistics';

export type ClothingManualEntryPresetId = Exclude<
  ClothingEntryScenarioId,
  'supplier-inventory' | 'shipment-logistics'
>;

export type ClothingEntryScenario = {
  id: ClothingEntryScenarioId;
  title: string;
  when: string;
  steps: string[];
  example: string;
  referenceHint: string;
  debitAccount?: string;
  creditAccount?: string;
  review: string;
  warning?: string;
  destination?: { href: string; label: string };
};

export const CLOTHING_ENTRY_SCENARIOS: ClothingEntryScenario[] = [
  {
    id: 'loan-received',
    title: 'Receive a loan',
    when: 'Loan funds have arrived in the business account.',
    steps: [
      'Enter only the amount actually received.',
      'Add the lender or loan name in the Loan Tag field.',
      'Use the bank or transfer reference so you can find the receipt later.',
    ],
    example: '₱50,000 received: Debit Cash, Credit Loan Payable.',
    referenceHint: 'e.g., LOAN-RECEIVED-2026-10-21',
    debitAccount: 'Cash',
    creditAccount: 'Loan Payable',
    review: 'Cash increases and the loan balance increases.',
  },
  {
    id: 'loan-principal',
    title: 'Pay loan principal',
    when: 'Part of a lender payment reduces the amount borrowed.',
    steps: [
      'Check the lender statement for the principal portion; do not guess the split.',
      'Use the same Loan Tag used when recording this loan.',
      'Enter only the principal portion and the actual payment reference.',
    ],
    example: '₱10,000 principal: Debit Loan Payable, Credit Cash.',
    referenceHint: 'e.g., LOAN-PAYMENT-2026-10-21',
    debitAccount: 'Loan Payable',
    creditAccount: 'Cash',
    review: 'The loan balance decreases and Cash decreases.',
    warning: 'Record interest separately. This entry is for principal only.',
  },
  {
    id: 'loan-interest',
    title: 'Pay loan interest',
    when: 'A lender payment includes an interest charge.',
    steps: [
      'Use the interest amount shown by the lender, separate from principal.',
      'Enter the actual payment date and the same reference as the principal entry.',
      'Save this as a separate entry from loan principal.',
    ],
    example: '₱2,000 interest: Debit Interest Expense, Credit Cash.',
    referenceHint: 'e.g., LOAN-PAYMENT-2026-10-21',
    debitAccount: 'Interest Expense',
    creditAccount: 'Cash',
    review: 'Interest Expense and Cash increase/decrease respectively.',
    warning:
      'Do not enter the full payment amount here if principal is also included.',
  },
  {
    id: 'owner-contribution',
    title: 'Add owner funds',
    when: 'The owner puts personal funds into the business.',
    steps: [
      'Enter the amount deposited into the business.',
      'Use the actual deposit date and bank or transfer reference.',
    ],
    example: '₱15,000 added: Debit Cash, Credit Owner Contribution.',
    referenceHint: 'e.g., OWNER-FUND-2026-10-21',
    debitAccount: 'Cash',
    creditAccount: 'Owner Contribution',
    review: 'Cash and Owner Contribution increase.',
  },
  {
    id: 'owner-withdrawal',
    title: 'Withdraw owner funds',
    when: 'The owner takes business funds for personal use.',
    steps: [
      'Enter the amount withdrawn from the business.',
      'Use the actual withdrawal date and bank or transfer reference.',
    ],
    example: '₱5,000 withdrawn: Debit Owner Draw, Credit Cash.',
    referenceHint: 'e.g., OWNER-DRAW-2026-10-21',
    debitAccount: 'Owner Draw',
    creditAccount: 'Cash',
    review: 'Owner Draw increases and Cash decreases.',
  },
  {
    id: 'supplier-inventory',
    title: 'Supplier items and inventory',
    when: 'Recording supplier purchases, payment status, or received stock.',
    steps: [
      'Use Products to record the supplier items and payment status.',
      'Run Transit Build-Up for the supplier Grand Total; check whether it uses Cash or Supplier Payable.',
      'When an unpaid product changes to paid, the supplier settlement can post automatically if its transit build-up exists.',
      'After the shipment is Delivered, run the separate reclassification to Stock on Hand.',
    ],
    example:
      'Transit Build-Up and delivery reclassification are separate actions; Delivered status alone does not reclass inventory.',
    referenceHint: '',
    review: '',
    warning:
      'Check the ledger before making a manual entry. Repeating a product or shipment posting can duplicate accounting.',
    destination: {
      href: '/clothing/operations/products',
      label: 'Open Products',
    },
  },
  {
    id: 'shipment-logistics',
    title: 'Forwarder, courier, and packaging costs',
    when: 'Recording shipment logistics estimates, payments, or actual costs.',
    steps: [
      'Open the shipment and choose Logistics Costs.',
      'Choose the vendor, shipment, and next recommended action.',
      'Record the estimate, adjust it to the actual amount if needed, and settle the payable when paid.',
      'After delivery, capitalize the cost into Stock on Hand.',
    ],
    example:
      'The workflow uses the configured payable and clearing accounts; do not create a second entry in the ledger.',
    referenceHint: '',
    review: '',
    warning:
      'Check the shipment history first. The Logistics Costs workflow tracks which steps have already been posted.',
    destination: {
      href: '/clothing/operations/shipments',
      label: 'Open Shipments',
    },
  },
];

export const CLOTHING_MANUAL_ACCOUNT_DEFAULTS = [
  'Cash',
  'Accounts Receivable',
  'Accounts Payable',
  'Credit Card Payable',
  'Loan Payable',
  'Owner Contribution',
  'Owner Draw',
  'Interest Expense',
] as const;

export const CLOTHING_NON_ROUTINE_ENTRY_ACCOUNTS = new Set([
  'Sales Revenue',
  'Sales Returns',
  'Customer Deposits',
  'Customer Deposit',
  'Forfeited Deposits',
  'Stock on Hand',
  'Inventory in Transit',
  'Landed Cost Clearing',
  'Forwarder Payable',
  'Courier Payable',
  'Opening Equity',
  'COGS',
  'Inventory Shrinkage',
  'Supplier Payable',
  'Payroll',
]);

export function getClothingManualEntryAccounts(
  availableAccounts: string[],
  preserveSelectedAccounts: string[] = []
): string[] {
  const preserved = new Set(preserveSelectedAccounts);
  const accounts = collapseTaggableAccountsForOptions([
    ...availableAccounts,
    ...CLOTHING_MANUAL_ACCOUNT_DEFAULTS,
  ]);

  return accounts.filter(
    (account) =>
      !CLOTHING_NON_ROUTINE_ENTRY_ACCOUNTS.has(account) ||
      preserved.has(account)
  );
}

export function getClothingEntryScenario(
  id: ClothingEntryScenarioId | null
): ClothingEntryScenario | undefined {
  return id
    ? CLOTHING_ENTRY_SCENARIOS.find((scenario) => scenario.id === id)
    : undefined;
}
