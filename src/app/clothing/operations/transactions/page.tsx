/**
 * Transactions Page Route Handler
 *
 * This is a Next.js App Router page that delegates to the modular transactions component.
 * The actual implementation is in /src/modules/clothing/operations/transactions/
 *
 * ✅ All business logic is preserved in TransactionService
 * ✅ All UI logic is in TransactionsPage component
 * ✅ Route handler reduced from 3,857 lines to 13 lines
 *
 * 📋 Original file backed up at: page.tsx.backup
 *
 * Note: Direct import path used to optimize compilation speed
 */

import { TransactionsPage } from '@/modules/clothing/operations/transactions/components/TransactionsPage';

export default function TransactionsRoute() {
  return <TransactionsPage />;
}
