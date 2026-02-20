/**
 * Transactions Page Route Handler
 *
 * This is a Next.js App Router page that delegates to the modular transactions component.
 * The actual implementation is in /src/modules/clothing/operations/transactions/
 *
 * ✅ All business logic is preserved in TransactionService
 * ✅ All UI logic is in TransactionsPage component
 * ✅ Error boundary added for graceful error handling
 * ✅ Route handler optimized for performance
 * ✅ Module-level permission checking with SweetAlert
 *
 * 📋 Original file backed up at: page.tsx.backup
 *
 * Note: Direct import path used to optimize compilation speed
 */

import type { Metadata } from 'next';
import { TransactionsRoutePage } from '@/app/operations/transactions/_shared/TransactionsRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export const metadata: Metadata = {
  title: 'Transactions',
};

export default async function TransactionsRoute() {
  return renderOperationsPage(
    '/clothing/operations/transactions',
    <TransactionsRoutePage />
  );
}
