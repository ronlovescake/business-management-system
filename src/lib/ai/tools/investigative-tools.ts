import { prisma } from '@/lib/db';
import { normalizeAccountForReporting } from '@/lib/accounting/account-normalization';
import { PAID_STATUSES } from '@/lib/accounting/constants';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  fetchApprovedExpenses,
  fetchManualJournalLines,
  fetchRecognizedTransactions,
  fetchTransactionPayments,
  fetchTransactionRefunds,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import { parseDate } from '@/lib/accounting/date-utils';
import { getExpenseCreditAccount } from '@/lib/accounting/payment-accounts';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import {
  getAccountsReceivableRecognitionDate,
  getTransactionPaymentDebitAccount,
  hasAccountsReceivableShipment,
} from '@/lib/accounting/transaction-recognition';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import type {
  AiBusinessUnit,
  AiToolDefinition,
  AiToolExecutionContext,
} from '../types';

const EPS = 0.01;

function normalizeBusinessUnitArg(raw: unknown): AiBusinessUnit {
  if (raw === 'trucking' || raw === 'general-merchandise') {
    return raw;
  }
  return 'clothing';
}

function assertBusinessUnitAccessLocal(
  context: AiToolExecutionContext,
  businessUnit: AiBusinessUnit
): void {
  if (!context.allowedBusinessUnits.includes(businessUnit)) {
    throw new Error(
      `Access denied: current user is not authorized to read ${businessUnit} records.`
    );
  }
}

const FORBIDDEN_SQL_KEYWORDS =
  /\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|copy|call|do|execute|prepare|deallocate|set|reset|begin|commit|rollback|savepoint|release|lock|vacuum|analyze|refresh|cluster|reindex|discard|comment|security|owner|reassign|notify|listen|unlisten|load|import|export|pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|dblink|lo_import|lo_export|lo_unlink)\b/i;

const FORBIDDEN_SQL_IDENTIFIERS =
  /\b(users|password_reset_tokens|user_permissions|modules|installed_modules|module_marketplace|ai_assistant_settings|ai_audit_logs|ai_monitoring_alerts|conversations|conversation_participants|messages|message_hidden_for_users|pg_catalog|information_schema|pg_shadow|pg_authid|pg_roles|pg_user|pg_settings|pg_stat_activity|household_expenses|household_recurring_payments|householdaccounts|householdincome|householdbudget)\b/i;

const ALLOWED_TABLES_BY_UNIT: Record<AiBusinessUnit, ReadonlySet<string>> = {
  clothing: new Set([
    'customer',
    'public.customer',
    'additional_customer_info',
    'public.additional_customer_info',
    'products',
    'public.products',
    'prices',
    'public.prices',
    'shipments',
    'public.shipments',
    'inventory_movements',
    'public.inventory_movements',
    'transactions',
    'public.transactions',
    'transaction_payments',
    'public.transaction_payments',
    'transaction_refunds',
    'public.transaction_refunds',
    'clothing_order_cancellations',
    'public.clothing_order_cancellations',
    'clothing_refund_payouts',
    'public.clothing_refund_payouts',
    'transaction_status_changes',
    'public.transaction_status_changes',
    'expenses',
    'public.expenses',
    'clothingaccountingopeningbalance',
    'public.clothingaccountingopeningbalance',
    'clothing_accounting_journal_lines',
    'public.clothing_accounting_journal_lines',
    'clothing_recurring_payment_templates',
    'public.clothing_recurring_payment_templates',
    'clothing_recurring_payment_drafts',
    'public.clothing_recurring_payment_drafts',
    'clothing_supplier_credits',
    'public.clothing_supplier_credits',
    'employees',
    'public.employees',
    'schedules',
    'public.schedules',
    'attendance',
    'public.attendance',
    'leave_requests',
    'public.leave_requests',
    'cash_advances',
    'public.cash_advances',
    'payrolls',
    'public.payrolls',
  ]),
  trucking: new Set([
    'customer',
    'public.customer',
    'trucking_fleet_registry',
    'public.trucking_fleet_registry',
    'trucking_trips',
    'public.trucking_trips',
    'trucking_vehicle_assignments',
    'public.trucking_vehicle_assignments',
    'trucking_invoices',
    'public.trucking_invoices',
    'trucking_payments',
    'public.trucking_payments',
    'trucking_payment_allocations',
    'public.trucking_payment_allocations',
    'trucking_expenses',
    'public.trucking_expenses',
    'trucking_employees',
    'public.trucking_employees',
    'trucking_schedules',
    'public.trucking_schedules',
    'trucking_attendance',
    'public.trucking_attendance',
    'trucking_leave_requests',
    'public.trucking_leave_requests',
    'trucking_cash_advances',
    'public.trucking_cash_advances',
    'trucking_payrolls',
    'public.trucking_payrolls',
  ]),
  'general-merchandise': new Set([
    'general_merchandise.customers',
    'general_merchandise.additional_customer_info',
    'general_merchandise.products',
    'general_merchandise.prices',
    'general_merchandise.shipments',
    'general_merchandise.inventory_movements',
    'general_merchandise.transactions',
    'general_merchandise.transaction_payments',
    'general_merchandise.transaction_refunds',
    'general_merchandise.transaction_status_changes',
    'general_merchandise.expenses',
    'general_merchandise.accounting_opening_balance',
    'general_merchandise.accounting_journal_lines',
    'general_merchandise.recurring_payment_templates',
    'general_merchandise.recurring_payment_drafts',
    'general_merchandise.employees',
    'general_merchandise.schedules',
    'general_merchandise.attendance',
    'general_merchandise.leave_requests',
    'general_merchandise.cash_advances',
    'general_merchandise.payrolls',
  ]),
};

export function validateAndBoundReadOnlySql(
  rawSql: string,
  businessUnit: AiBusinessUnit,
  maxRows = 50
): string {
  const trimmed = rawSql
    .trim()
    .replace(/;+\s*$/, '')
    .trim();
  if (!trimmed) {
    throw new Error('Read-only SQL guard rejected query: SQL query is empty.');
  }

  if (trimmed.includes(';')) {
    throw new Error(
      'Read-only SQL guard rejected query: multiple statements or semicolons are not allowed.'
    );
  }

  if (/--|\/\*/.test(trimmed)) {
    throw new Error(
      'Read-only SQL guard rejected query: SQL comments are not allowed.'
    );
  }

  const strippedStrings = trimmed.replace(/'(?:''|[^'])*'/g, "''");

  if (!/^(?:select|with)\b/i.test(strippedStrings)) {
    throw new Error(
      'Read-only SQL guard rejected query: only SELECT queries are permitted.'
    );
  }

  if (FORBIDDEN_SQL_KEYWORDS.test(strippedStrings)) {
    throw new Error(
      'Read-only SQL guard rejected query: mutating, administrative, or unsafe SQL keywords are forbidden.'
    );
  }

  if (FORBIDDEN_SQL_IDENTIFIERS.test(strippedStrings)) {
    throw new Error(
      'Read-only SQL guard rejected query: access to sensitive user, authentication, system, or AI configuration tables is forbidden.'
    );
  }

  // Extract CTE aliases so `WITH cte_name AS (...) SELECT ... FROM cte_name` is recognized
  const cteAliases = new Set<string>();
  const cteRegex = /\b(?:with|,)\s+"?([a-zA-Z0-9_]+)"?\s+as\s*\(/gi;
  let cteMatch = cteRegex.exec(strippedStrings);
  while (cteMatch) {
    cteAliases.add(cteMatch[1].toLowerCase());
    cteMatch = cteRegex.exec(strippedStrings);
  }

  // Validate all FROM and JOIN table references (excluding EXTRACT(... FROM ...))
  const tableRefRegex =
    /\b(?:from|join)\s+(?!\s*\()("?[a-zA-Z0-9_]+"?(?:\s*\.\s*"?[a-zA-Z0-9_]+"?)?)/gi;
  const allowedTables = ALLOWED_TABLES_BY_UNIT[businessUnit];
  const referencedTables: string[] = [];

  let match = tableRefRegex.exec(strippedStrings);
  while (match) {
    const beforeIndex = match.index;
    const prefixSlice = strippedStrings
      .slice(Math.max(0, beforeIndex - 30), beforeIndex)
      .toLowerCase();
    // Skip `EXTRACT(epoch FROM ...)` or `TRIM(... FROM ...)`
    if (
      /(?:extract|trim|overlay|substring|position)\s*\([^)]*$/.test(prefixSlice)
    ) {
      match = tableRefRegex.exec(strippedStrings);
      continue;
    }

    const rawIdentifier = match[1]
      .replace(/"/g, '')
      .replace(/\s*\.\s*/g, '.')
      .trim()
      .toLowerCase();

    if (!cteAliases.has(rawIdentifier)) {
      referencedTables.push(rawIdentifier);
      if (!allowedTables.has(rawIdentifier)) {
        throw new Error(
          `Read-only SQL guard rejected query: table "${rawIdentifier}" is not in the allowed read-only table list for business unit "${businessUnit}".`
        );
      }
    }

    match = tableRefRegex.exec(strippedStrings);
  }

  if (referencedTables.length === 0) {
    throw new Error(
      'Read-only SQL guard rejected query: SELECT must query at least one allowed business table.'
    );
  }

  const safeLimit = Math.min(25, Math.max(1, maxRows));
  return `SELECT * FROM (${trimmed}) AS _readonly_subquery LIMIT ${safeLimit}`;
}

function serializeSqlValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === 'bigint') {
    const asNum = Number(val);
    return Number.isSafeInteger(asNum) ? asNum : val.toString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map(serializeSqlValue);
  }
  if (typeof val === 'object') {
    const maybeToNumber = Reflect.get(val as object, 'toNumber');
    if (typeof maybeToNumber === 'function') {
      return (maybeToNumber as () => number).call(val);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = serializeSqlValue(v);
    }
    return out;
  }
  return val;
}

export const INVESTIGATIVE_BUSINESS_TOOLS: readonly AiToolDefinition[] = [
  {
    name: 'reconcileCashAndFindDiscrepancies',
    description:
      'Read-only forensic accounting tool that calculates the exact recorded book cash & bank balance for a business unit, compares it against an actual cash amount stated by the user (if provided), computes the exact variance, and automatically scans payments, duplicate receipts, overpaid orders, unposted recurring payment drafts, pending cancellation refunds, and approved-but-unpaid expenses to explain why actual cash does not match book records.',
    businessUnits: ['clothing', 'trucking', 'general-merchandise'],
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        businessUnit: {
          type: 'string',
          description: 'Business domain to reconcile',
          enum: ['clothing', 'trucking', 'general-merchandise'],
        },
        actualCashAmount: {
          type: 'number',
          description:
            'Optional actual cash/bank balance stated by the user (e.g., 100000) to compare against the recorded book balance.',
        },
      },
      required: ['businessUnit'],
    },
    execute: async (args, context) => {
      const unit = normalizeBusinessUnitArg(args.businessUnit);
      assertBusinessUnitAccessLocal(context, unit);

      const hasActualCash =
        args.actualCashAmount !== undefined &&
        args.actualCashAmount !== null &&
        Number.isFinite(Number(args.actualCashAmount));
      const actualCashAmount = hasActualCash
        ? Number(Number(args.actualCashAmount).toFixed(2))
        : null;

      if (unit === 'trucking') {
        const [payments, expenses, invoices] = await Promise.all([
          prisma.truckingPayment?.findMany
            ? prisma.truckingPayment.findMany({
                include: {
                  customer: { select: { customerName: true } },
                  allocations: { select: { amount: true, invoiceId: true } },
                },
                orderBy: { paymentDate: 'desc' },
              })
            : Promise.resolve([]),
          prisma.truckingExpense?.findMany
            ? prisma.truckingExpense.findMany({
                where: { status: { in: ['approved', 'paid'] } },
                orderBy: { date: 'desc' },
              })
            : Promise.resolve([]),
          prisma.truckingInvoice.findMany({
            include: {
              customer: { select: { customerName: true } },
              allocations: { select: { amount: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
          }),
        ]);

        const totalPaymentsCollected = Number(
          payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0).toFixed(2)
        );
        const paidExpenses = Number(
          expenses
            .filter((e) => e.status.toLowerCase() === 'paid')
            .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
            .toFixed(2)
        );
        const approvedUnpaidExpenses = Number(
          expenses
            .filter((e) => e.status.toLowerCase() === 'approved')
            .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
            .toFixed(2)
        );
        const recordedBookCash = Number(
          (totalPaymentsCollected - paidExpenses).toFixed(2)
        );
        const variance =
          actualCashAmount !== null
            ? Number((actualCashAmount - recordedBookCash).toFixed(2))
            : null;

        const invoiceMismatches = [];
        for (const inv of invoices) {
          const total = Number(inv.totalAmount);
          const allocated = inv.allocations.reduce(
            (s: number, a: { amount: unknown }) => s + Number(a.amount),
            0
          );
          const diff = Number((total - allocated).toFixed(2));
          if (inv.status === 'PAID' && Math.abs(diff) > EPS) {
            invoiceMismatches.push({
              invoiceId: inv.id,
              customer: inv.customer.customerName,
              invoiceTotal: total,
              allocatedPayments: Number(allocated.toFixed(2)),
              discrepancyAmount: diff,
            });
          }
        }

        return {
          businessUnit: 'trucking',
          recordedBookCash,
          actualCashAmount,
          variance,
          breakdown: {
            totalPaymentsCollected,
            paidExpenses,
            approvedUnpaidExpenses,
          },
          potentialCulprits: {
            invoiceMismatches,
          },
          sourceLink: '/trucking/accounting',
        };
      }

      if (unit === 'general-merchandise') {
        const [txRows, recurringTemplates] = await Promise.all([
          prisma.generalMerchandiseTransaction.findMany({
            where: { deletedAt: null },
            include: {
              payments: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  amount: true,
                  paymentDate: true,
                  method: true,
                },
              },
            },
            orderBy: { id: 'desc' },
            take: 300,
          }),
          prisma.generalMerchandiseRecurringPaymentTemplate.findMany({
            where: { isActive: true },
            include: {
              drafts: { where: { status: 'DRAFT' } },
            },
          }),
        ]);

        let totalCollected = 0;
        const orderAnomalies = [];
        for (const tx of txRows) {
          const gross = Number(
            (
              Number(tx.quantity ?? 0) * Number(tx.unitPrice ?? 0) -
              Number(tx.discount ?? 0)
            ).toFixed(2)
          );
          const adj = Number(tx.adjustment ?? 0);
          const lineTotal = Number(tx.lineTotal ?? 0);
          const paymentSum = Number(
            (tx.payments ?? [])
              .reduce((s, p) => s + Number(p.amount ?? 0), 0)
              .toFixed(2)
          );
          totalCollected += paymentSum > 0 ? paymentSum : Math.max(0, adj);

          if (Math.abs(lineTotal - (gross - adj)) > EPS || lineTotal < -EPS) {
            orderAnomalies.push({
              transactionId: tx.id,
              customer: tx.customers ?? 'Unknown',
              grossSale: gross,
              adjustment: adj,
              recordedPaymentRowsSum: paymentSum,
              lineTotal,
              discrepancyAmount: Number((lineTotal - (gross - adj)).toFixed(2)),
            });
          }
        }

        const recordedBookCash = Number(totalCollected.toFixed(2));
        const variance =
          actualCashAmount !== null
            ? Number((actualCashAmount - recordedBookCash).toFixed(2))
            : null;

        return {
          businessUnit: 'general-merchandise',
          recordedBookCash,
          actualCashAmount,
          variance,
          potentialCulprits: {
            orderAnomalies: orderAnomalies.slice(0, 15),
            unpostedRecurringTemplates: recurringTemplates.map((t) => ({
              id: t.id,
              name: t.name,
              amount: t.amount,
              nextDueDate: t.nextDueDate.toISOString().slice(0, 10),
              pendingDrafts: t.drafts.length,
            })),
          },
          sourceLink: '/general-merchandise/accounting',
        };
      }

      // CLOTHING AUTHORITATIVE BALANCE SHEET CASH & FORENSIC RECONCILIATION
      const cutover = await getRuntimeAccountingCutoverDate();
      const asOf = new Date();

      const openingModel = Reflect.get(
        prisma,
        'clothingAccountingOpeningBalance'
      ) as
        | {
            findMany?: (
              args: unknown
            ) => Promise<Array<Record<string, unknown>>>;
          }
        | undefined;
      const cancellationModel = Reflect.get(
        prisma,
        'clothingOrderCancellation'
      ) as
        | {
            findMany?: (
              args: unknown
            ) => Promise<Array<Record<string, unknown>>>;
          }
        | undefined;

      const [
        transactions,
        payments,
        expenses,
        refunds,
        manualLines,
        openingBalanceRows,
        recurringTemplates,
        pendingCancellations,
        recentTransactions,
      ] = await Promise.all([
        fetchRecognizedTransactions(),
        fetchTransactionPayments(),
        fetchApprovedExpenses(),
        fetchTransactionRefunds(),
        fetchManualJournalLines({ from: cutover, to: asOf }),
        openingModel?.findMany
          ? openingModel.findMany({
              where: {
                deletedAt: null,
                date: { gte: cutover, lte: asOf },
              },
              orderBy: { date: 'asc' },
            })
          : Promise.resolve([]),
        prisma.clothingRecurringPaymentTemplate.findMany({
          where: { isActive: true },
          include: {
            drafts: {
              where: { status: 'DRAFT' },
              orderBy: { dueDate: 'asc' },
            },
          },
          orderBy: { nextDueDate: 'asc' },
        }),
        cancellationModel?.findMany
          ? cancellationModel.findMany({
              where: { pendingAmount: { gt: 0 } },
              include: {
                transaction: {
                  select: {
                    id: true,
                    customers: true,
                    productCode: true,
                    orderStatus: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 25,
            })
          : Promise.resolve([]),
        prisma.transaction.findMany({
          where: { deletedAt: null },
          orderBy: { id: 'desc' },
          take: 400,
        }),
      ]);

      // 1. Opening Balances mapped to Cash
      let openingCashEquivalents = 0;
      let openingPhysicalCashOnly = 0;
      const openingBreakdown: Array<{
        account: string;
        ref: string;
        description: string | null;
        amount: number;
      }> = [];

      for (const entry of openingBalanceRows) {
        const account = String(entry.account ?? '').trim();
        const amount = Number(entry.debit ?? 0) - Number(entry.credit ?? 0);
        if (!account || !Number.isFinite(amount) || Math.abs(amount) < EPS) {
          continue;
        }
        if (normalizeAccountForReporting(account) === 'Cash') {
          openingCashEquivalents += amount;
          if (account.toLowerCase() === 'cash') {
            openingPhysicalCashOnly += amount;
          }
          openingBreakdown.push({
            account,
            ref: String(entry.ref ?? ''),
            description: (entry.description as string | null) ?? null,
            amount: Number(amount.toFixed(2)),
          });
        }
      }

      // 2. Customer Payments (TransactionPayment rows)
      const paymentTotalsByTxId = new Map<number, number>();
      const paymentTotalsAllByTxId = new Map<number, number>();
      const earliestPaymentAtByTxId = new Map<number, Date>();
      const earliestIncludedPaymentAtByTxId = new Map<number, Date>();
      const cardTotalsByTxId = new Map<number, number>();
      const cardReservationTotalsByTxId = new Map<number, number>();
      const paymentEventTxIds = new Set<number>();
      const recordedPaymentTxIds = new Set<number>();
      const recordedNonReservationPaymentTxIds = new Set<number>();
      const paymentsByTxId = new Map<
        number,
        Array<{
          id: number;
          amount: number;
          paymentDate: string;
          method: string | null;
          isReservation: boolean;
          createdAt: string;
        }>
      >();

      let customerPaymentsCashEquivalents = 0;
      let customerPaymentsPhysicalCashOnly = 0;
      const paymentsByMethod: Record<string, number> = {};

      for (const payment of payments) {
        const isReservation = Boolean(payment.isReservation);
        const amt = Number(payment.amount ?? 0);
        if (!Number.isFinite(amt) || amt <= 0) {
          continue;
        }

        const list = paymentsByTxId.get(payment.transactionId) ?? [];
        list.push({
          id: payment.id,
          amount: amt,
          paymentDate: payment.paymentDate,
          method: payment.method,
          isReservation,
          createdAt:
            payment.createdAt instanceof Date
              ? payment.createdAt.toISOString()
              : String(payment.createdAt ?? ''),
        });
        paymentsByTxId.set(payment.transactionId, list);

        recordedPaymentTxIds.add(payment.transactionId);
        if (!isReservation) {
          recordedNonReservationPaymentTxIds.add(payment.transactionId);
        }

        const paymentAt = parseDate(payment.paymentDate);
        if (!isWithinDateRange(paymentAt, cutover, asOf)) {
          continue;
        }

        paymentEventTxIds.add(payment.transactionId);
        const debitAccount = getTransactionPaymentDebitAccount(payment);
        const methodKey =
          (payment.method ?? 'CASH').trim().toUpperCase() || 'CASH';
        paymentsByMethod[methodKey] = Number(
          ((paymentsByMethod[methodKey] ?? 0) + amt).toFixed(2)
        );

        if (normalizeAccountForReporting(debitAccount) === 'Cash') {
          customerPaymentsCashEquivalents += amt;
          if (debitAccount === 'Cash') {
            customerPaymentsPhysicalCashOnly += amt;
          }
        }

        if (debitAccount === 'Card Collections Clearing') {
          cardTotalsByTxId.set(
            payment.transactionId,
            (cardTotalsByTxId.get(payment.transactionId) ?? 0) + amt
          );
          if (isReservation) {
            cardReservationTotalsByTxId.set(
              payment.transactionId,
              (cardReservationTotalsByTxId.get(payment.transactionId) ?? 0) +
                amt
            );
          }
        }

        paymentTotalsAllByTxId.set(
          payment.transactionId,
          (paymentTotalsAllByTxId.get(payment.transactionId) ?? 0) + amt
        );
        const existingEarliestIncluded = earliestIncludedPaymentAtByTxId.get(
          payment.transactionId
        );
        if (
          paymentAt &&
          (!existingEarliestIncluded || paymentAt < existingEarliestIncluded)
        ) {
          earliestIncludedPaymentAtByTxId.set(payment.transactionId, paymentAt);
        }

        if (!isReservation) {
          paymentTotalsByTxId.set(
            payment.transactionId,
            (paymentTotalsByTxId.get(payment.transactionId) ?? 0) + amt
          );
          const existingEarliest = earliestPaymentAtByTxId.get(
            payment.transactionId
          );
          if (
            paymentAt &&
            (!existingEarliest || paymentAt < existingEarliest)
          ) {
            earliestPaymentAtByTxId.set(payment.transactionId, paymentAt);
          }
        }
      }

      // 3. Legacy unitemized adjustments on recognized transactions without TransactionPayment rows
      let legacyAdjustmentsCash = 0;
      const isPaidStatus = (status: string | null | undefined) =>
        (PAID_STATUSES as readonly string[]).includes((status ?? '').trim());

      for (const tx of transactions) {
        if (recordedPaymentTxIds.has(tx.id)) {
          continue;
        }
        const normalized = normalizeTransactionAmountsForAccounting(tx);
        const hasArLifecycle = hasAccountsReceivableShipment(tx);
        const receivableAt = hasArLifecycle
          ? getAccountsReceivableRecognitionDate(tx)
          : null;
        const recognizesReceivable = Boolean(
          receivableAt && isWithinDateRange(receivableAt, cutover, asOf)
        );
        const paidAt = isPaidStatus(tx.orderStatus) ? getPaidAtDate(tx) : null;
        const recognizesPaidStatus = Boolean(
          paidAt && isWithinDateRange(paidAt, cutover, asOf)
        );
        const usePaymentEvents =
          paymentEventTxIds.has(tx.id) ||
          recordedNonReservationPaymentTxIds.has(tx.id);
        const paymentReceived = usePaymentEvents
          ? Math.max(paymentTotalsByTxId.get(tx.id) ?? 0, 0)
          : Number(normalized.paymentReceived ?? 0);
        const paymentReceivedAll = usePaymentEvents
          ? Math.max(paymentTotalsAllByTxId.get(tx.id) ?? 0, 0)
          : paymentReceived;
        const includeRecognizedDeposits =
          recognizesPaidStatus || recognizesReceivable;
        const resolvedPaymentReceived = includeRecognizedDeposits
          ? paymentReceivedAll
          : paymentReceived;

        const recognizedAt = recognizesReceivable
          ? receivableAt
          : isPaidStatus(tx.orderStatus)
            ? getPaidAtDate(tx)
            : (earliestPaymentAtByTxId.get(tx.id) ??
              parseDate(tx.orderDate) ??
              null);

        if (!isWithinDateRange(recognizedAt, cutover, asOf)) {
          continue;
        }

        const receipts = Math.max(Number(resolvedPaymentReceived) || 0, 0);
        const cardCollections = Math.max(
          (cardTotalsByTxId.get(tx.id) ?? 0) -
            (includeRecognizedDeposits
              ? 0
              : (cardReservationTotalsByTxId.get(tx.id) ?? 0)),
          0
        );
        const cash = Math.max(receipts - cardCollections, 0);
        if (cash > 0) {
          legacyAdjustmentsCash += cash;
        }
      }

      // 4. Paid Expenses & Approved-but-Unpaid Expenses
      let paidExpensesCashEquivalents = 0;
      let paidExpensesPhysicalCashOnly = 0;
      const approvedUnpaidExpenses: Array<{
        id: number;
        date: string;
        category: string;
        description: string;
        amount: number;
        paymentMethod: string | null;
      }> = [];

      for (const exp of expenses) {
        const amount = Math.max(Number(exp.amount ?? 0), 0);
        const expDate = parseDate(exp.date);
        if (!Number.isFinite(amount) || amount <= 0) {
          continue;
        }
        if (exp.status.trim().toLowerCase() === 'approved') {
          approvedUnpaidExpenses.push({
            id: exp.id,
            date: exp.date,
            category: exp.category,
            description: exp.description,
            amount: Number(amount.toFixed(2)),
            paymentMethod: exp.paymentMethod ?? null,
          });
        }
        if (!isWithinDateRange(expDate, cutover, asOf)) {
          continue;
        }
        const creditAccount = getExpenseCreditAccount(exp);
        if (normalizeAccountForReporting(creditAccount) === 'Cash') {
          paidExpensesCashEquivalents += amount;
          if (creditAccount === 'Cash') {
            paidExpensesPhysicalCashOnly += amount;
          }
        }
      }

      // 5. Refunds Paid Out of Cash
      let refundsPaidCash = 0;
      for (const refund of refunds) {
        const refundAt = parseDate(refund.refundDate);
        if (!isWithinDateRange(refundAt, cutover, asOf)) {
          continue;
        }
        const amt = Number(refund.amount ?? 0);
        if (Number.isFinite(amt) && amt > 0) {
          refundsPaidCash += amt;
        }
      }

      // 6. Manual Journal Lines affecting Cash/Bank/GCash
      let manualJournalNetCashEquivalents = 0;
      let manualJournalNetPhysicalCashOnly = 0;
      const manualCashLines: Array<{
        id: string;
        date: string;
        ref: string;
        account: string;
        debit: number;
        credit: number;
        netCashImpact: number;
        description: string | null;
      }> = [];

      for (const line of manualLines) {
        const account = line.account.trim();
        const net = Number(line.debit ?? 0) - Number(line.credit ?? 0);
        if (!account || !Number.isFinite(net) || Math.abs(net) < EPS) {
          continue;
        }
        if (normalizeAccountForReporting(account) === 'Cash') {
          manualJournalNetCashEquivalents += net;
          if (account.toLowerCase() === 'cash') {
            manualJournalNetPhysicalCashOnly += net;
          }
          manualCashLines.push({
            id: line.id,
            date:
              line.date instanceof Date
                ? line.date.toISOString().slice(0, 10)
                : String(line.date),
            ref: line.ref,
            account,
            debit: Number(line.debit ?? 0),
            credit: Number(line.credit ?? 0),
            netCashImpact: Number(net.toFixed(2)),
            description: line.description,
          });
        }
      }

      const recordedBookCashEquivalents = Number(
        (
          openingCashEquivalents +
          customerPaymentsCashEquivalents +
          legacyAdjustmentsCash -
          paidExpensesCashEquivalents -
          refundsPaidCash +
          manualJournalNetCashEquivalents
        ).toFixed(2)
      );

      const recordedPhysicalCashOnly = Number(
        (
          openingPhysicalCashOnly +
          customerPaymentsPhysicalCashOnly +
          legacyAdjustmentsCash -
          paidExpensesPhysicalCashOnly -
          refundsPaidCash +
          manualJournalNetPhysicalCashOnly
        ).toFixed(2)
      );

      const varianceVsBookCashEquivalents =
        actualCashAmount !== null
          ? Number((actualCashAmount - recordedBookCashEquivalents).toFixed(2))
          : null;
      const varianceVsPhysicalCashOnly =
        actualCashAmount !== null
          ? Number((actualCashAmount - recordedPhysicalCashOnly).toFixed(2))
          : null;

      // 7. Scan for Duplicate Payments, Overpaid Orders & Formula Mismatches
      const duplicateOrOverpaidOrders: Array<Record<string, unknown>> = [];
      for (const tx of recentTransactions) {
        const qty = Number(tx.quantity ?? 0);
        const price = Number(tx.unitPrice ?? 0);
        const gross = Number((qty * price).toFixed(2));
        const adj = Number(tx.adjustment ?? 0);
        const lineTotal = Number(tx.lineTotal ?? 0);
        const expectedLineTotal = Number((gross - adj).toFixed(2));
        const status = (tx.orderStatus ?? '').trim();
        const closed = isCancelledOrderStatus(status);
        const txPayments = paymentsByTxId.get(tx.id) ?? [];
        const sumPayments = Number(
          txPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)
        );

        // Check for duplicate payment rows on the same order (same amount recorded twice)
        const duplicatePayments: Array<Record<string, unknown>> = [];
        for (let i = 0; i < txPayments.length; i += 1) {
          for (let j = i + 1; j < txPayments.length; j += 1) {
            if (
              Math.abs(txPayments[i].amount - txPayments[j].amount) <= EPS &&
              txPayments[i].paymentDate === txPayments[j].paymentDate
            ) {
              duplicatePayments.push({
                firstPaymentId: txPayments[i].id,
                secondPaymentId: txPayments[j].id,
                amountEach: txPayments[i].amount,
                paymentDate: txPayments[i].paymentDate,
                method: txPayments[i].method,
              });
            }
          }
        }

        const isOverpaid = !closed && (lineTotal < -EPS || adj - gross > EPS);
        const hasClosedResidual = closed && Math.abs(lineTotal) > EPS;
        const hasFormulaMismatch =
          !closed && Math.abs(lineTotal - expectedLineTotal) > EPS;

        if (
          isOverpaid ||
          hasClosedResidual ||
          hasFormulaMismatch ||
          duplicatePayments.length > 0
        ) {
          duplicateOrOverpaidOrders.push({
            transactionId: tx.id,
            customer: tx.customers ?? 'Unknown',
            productCode: tx.productCode ?? '',
            orderDate: tx.orderDate ?? '',
            orderStatus: status,
            grossSale: gross,
            recordedAdjustment: adj,
            recordedPaymentsSum: sumPayments,
            lineTotal,
            overpaymentOrDiscrepancyAmount: isOverpaid
              ? Number((adj - gross).toFixed(2))
              : lineTotal,
            duplicatePayments,
            explanation: isOverpaid
              ? `Order #${tx.id} (${tx.customers ?? 'Unknown'}) has grossSale ₱${gross.toFixed(2)} but recorded payments/adjustment of ₱${adj.toFixed(2)} (lineTotal ₱${lineTotal.toFixed(2)}), inflating recorded book cash by ₱${(adj - gross).toFixed(2)}.`
              : hasClosedResidual
                ? `Closed order #${tx.id} (${status}) still carries a non-zero lineTotal of ₱${lineTotal.toFixed(2)}.`
                : `Order #${tx.id} has a formula mismatch or duplicate payment entry on the same date.`,
            sourceLink: '/clothing/operations/transactions',
          });
        }
      }

      // 8. Exact or Near-Exact Variance Matches (if actualCashAmount was provided)
      const exactOrNearVarianceMatches: Array<Record<string, unknown>> = [];
      if (varianceVsBookCashEquivalents !== null) {
        const targetAbs = Math.abs(varianceVsBookCashEquivalents);
        const halfTargetAbs = Number((targetAbs / 2).toFixed(2));
        const tolerance = Math.max(5, Number((targetAbs * 0.005).toFixed(2)));

        if (targetAbs > EPS) {
          for (const p of payments.slice(-150)) {
            const amt = Number(p.amount ?? 0);
            if (
              Math.abs(amt - targetAbs) <= tolerance ||
              Math.abs(amt - halfTargetAbs) <= tolerance
            ) {
              exactOrNearVarianceMatches.push({
                type: 'TRANSACTION_PAYMENT',
                paymentId: p.id,
                transactionId: p.transactionId,
                customer: p.transaction?.customers ?? 'Unknown',
                amount: amt,
                paymentDate: p.paymentDate,
                method: p.method,
                matchNote:
                  Math.abs(amt - targetAbs) <= tolerance
                    ? 'Matches the cash variance amount'
                    : 'Matches half of the cash variance (possible double-counted or reversed entry)',
              });
            }
          }

          for (const line of manualCashLines) {
            const amt = Math.abs(line.netCashImpact);
            if (
              Math.abs(amt - targetAbs) <= tolerance ||
              Math.abs(amt - halfTargetAbs) <= tolerance
            ) {
              exactOrNearVarianceMatches.push({
                type: 'MANUAL_JOURNAL_LINE',
                lineId: line.id,
                ref: line.ref,
                account: line.account,
                netCashImpact: line.netCashImpact,
                date: line.date,
                description: line.description,
              });
            }
          }
        }
      }

      return {
        businessUnit: 'clothing',
        asOf: asOf.toISOString(),
        cutoverDate: cutover.toISOString().slice(0, 10),
        recordedBookCashEquivalents,
        recordedPhysicalCashOnly,
        actualCashAmount,
        varianceVsBookCashEquivalents,
        varianceVsPhysicalCashOnly,
        cashComponentsBreakdown: {
          openingCashEquivalents: Number(openingCashEquivalents.toFixed(2)),
          openingBreakdown,
          customerPaymentsCashEquivalents: Number(
            customerPaymentsCashEquivalents.toFixed(2)
          ),
          paymentsByMethod,
          legacyAdjustmentsCash: Number(legacyAdjustmentsCash.toFixed(2)),
          paidExpensesOutflow: Number(paidExpensesCashEquivalents.toFixed(2)),
          refundsPaidOutflow: Number(refundsPaidCash.toFixed(2)),
          manualJournalNetCash: Number(
            manualJournalNetCashEquivalents.toFixed(2)
          ),
          recentManualCashLines: manualCashLines.slice(-5),
        },
        potentialCulprits: {
          duplicateOrOverpaidOrders: duplicateOrOverpaidOrders.slice(0, 5),
          unpostedRecurringObligations: recurringTemplates
            .slice(0, 5)
            .map((t) => ({
              templateId: t.id,
              name: t.name,
              kind: t.kind,
              amount: t.amount,
              frequency: t.frequency,
              nextDueDate: t.nextDueDate.toISOString().slice(0, 10),
              pendingDraftsCount: t.drafts.length,
              pendingDrafts: t.drafts.slice(0, 3).map((d) => ({
                draftId: d.id,
                dueDate: d.dueDate.toISOString().slice(0, 10),
                amount: d.amount,
                status: d.status,
              })),
            })),
          pendingCancellationRefunds: pendingCancellations
            .slice(0, 5)
            .map((c) => {
              const tx = c.transaction as
                | {
                    id?: number;
                    customers?: string | null;
                    productCode?: string | null;
                  }
                | undefined;
              return {
                cancellationId: String(c.id ?? ''),
                transactionId: Number(c.transactionId ?? tx?.id ?? 0),
                customer: tx?.customers ?? 'Unknown',
                productCode: tx?.productCode ?? '',
                decisionDate: String(c.decisionDate ?? ''),
                approvedRefundAmount: Number(c.approvedRefundAmount ?? 0),
                pendingAmount: Number(c.pendingAmount ?? 0),
              };
            }),
          approvedButUnpaidExpenses: approvedUnpaidExpenses.slice(0, 5),
          exactOrNearVarianceMatches: exactOrNearVarianceMatches.slice(0, 5),
        },
        sourceLink: '/clothing/accounting',
      };
    },
  },
  {
    name: 'queryCustomersAndOrderHistory',
    description:
      'Read-only customer intelligence tool that looks up customers and their order/payment history for a business unit. Use this to answer questions like "Who is our oldest customer?", "Who are our newest or top-spending customers?", or to inspect a specific customer’s orders and payment records.',
    businessUnits: ['clothing', 'trucking', 'general-merchandise'],
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        businessUnit: {
          type: 'string',
          description: 'Business domain to query',
          enum: ['clothing', 'trucking', 'general-merchandise'],
        },
        search: {
          type: 'string',
          description:
            'Optional customer name, phone, or business name substring to search for.',
        },
        sortBy: {
          type: 'string',
          description:
            'How to sort customers: "oldest" (earliest registered / earliest first order), "newest", "highest_spend", or "most_orders".',
          enum: ['oldest', 'newest', 'highest_spend', 'most_orders'],
        },
        limit: {
          type: 'number',
          description: 'Maximum customers to return (1 to 25, default 10)',
        },
      },
      required: ['businessUnit'],
    },
    execute: async (args, context) => {
      const unit = normalizeBusinessUnitArg(args.businessUnit);
      assertBusinessUnitAccessLocal(context, unit);

      const search =
        typeof args.search === 'string' && args.search.trim().length > 0
          ? args.search.trim()
          : null;
      const sortBy =
        args.sortBy === 'newest' ||
        args.sortBy === 'highest_spend' ||
        args.sortBy === 'most_orders'
          ? args.sortBy
          : 'oldest';
      const limit = Math.min(25, Math.max(1, Number(args.limit) || 10));

      if (unit === 'trucking') {
        const invoices = await prisma.truckingInvoice.findMany({
          include: {
            customer: true,
            allocations: { select: { amount: true } },
          },
          orderBy: { createdAt: sortBy === 'newest' ? 'desc' : 'asc' },
        });

        const statsByCustomer = new Map<
          number,
          {
            customerId: number;
            customerName: string;
            registeredAt: string;
            firstInvoiceDate: string | null;
            invoiceCount: number;
            totalBilled: number;
            totalPaid: number;
          }
        >();

        for (const inv of invoices) {
          if (
            search &&
            !inv.customer.customerName
              .toLowerCase()
              .includes(search.toLowerCase())
          ) {
            continue;
          }
          const existing = statsByCustomer.get(inv.customerId) ?? {
            customerId: inv.customerId,
            customerName: inv.customer.customerName,
            registeredAt: inv.customer.createdAt.toISOString(),
            firstInvoiceDate: null,
            invoiceCount: 0,
            totalBilled: 0,
            totalPaid: 0,
          };
          existing.invoiceCount += 1;
          existing.totalBilled = Number(
            (existing.totalBilled + Number(inv.totalAmount)).toFixed(2)
          );
          const paid = inv.allocations.reduce(
            (s, a) => s + Number(a.amount),
            0
          );
          existing.totalPaid = Number((existing.totalPaid + paid).toFixed(2));
          const invDate = inv.createdAt.toISOString();
          if (
            !existing.firstInvoiceDate ||
            invDate < existing.firstInvoiceDate
          ) {
            existing.firstInvoiceDate = invDate;
          }
          statsByCustomer.set(inv.customerId, existing);
        }

        const list = Array.from(statsByCustomer.values());
        list.sort((a, b) => {
          if (sortBy === 'highest_spend') {
            return b.totalBilled - a.totalBilled;
          }
          if (sortBy === 'most_orders') {
            return b.invoiceCount - a.invoiceCount;
          }
          if (sortBy === 'newest') {
            return b.registeredAt.localeCompare(a.registeredAt);
          }
          return a.registeredAt.localeCompare(b.registeredAt);
        });

        return {
          businessUnit: 'trucking',
          sortBy,
          search,
          totalCustomersWithInvoices: list.length,
          customers: list.slice(0, limit),
          sourceLink: '/trucking/operations/trips',
        };
      }

      const customerModelName =
        unit === 'general-merchandise'
          ? 'generalMerchandiseCustomer'
          : 'customer';
      const customerModel = Reflect.get(prisma, customerModelName) as
        | {
            findMany?: (
              args: unknown
            ) => Promise<Array<Record<string, unknown>>>;
            count?: (args: unknown) => Promise<number>;
          }
        | undefined;

      const whereClause: Record<string, unknown> = {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { customerName: { contains: search, mode: 'insensitive' } },
                { businessName: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [registeredRows, totalRegisteredCount, txRows] = await Promise.all([
        customerModel?.findMany
          ? customerModel.findMany({
              where: whereClause,
              orderBy: [
                { createdAt: sortBy === 'newest' ? 'desc' : 'asc' },
                { id: sortBy === 'newest' ? 'desc' : 'asc' },
              ],
              take: limit,
            })
          : Promise.resolve([]),
        customerModel?.count
          ? customerModel.count({ where: { deletedAt: null } })
          : Promise.resolve(0),
        unit === 'general-merchandise'
          ? prisma.generalMerchandiseTransaction.findMany({
              where: {
                deletedAt: null,
                ...(search
                  ? { customers: { contains: search, mode: 'insensitive' } }
                  : {}),
              },
              include: {
                payments: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    amount: true,
                    paymentDate: true,
                    method: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: { id: 'asc' },
            })
          : prisma.transaction.findMany({
              where: {
                deletedAt: null,
                ...(search
                  ? { customers: { contains: search, mode: 'insensitive' } }
                  : {}),
              },
              include: {
                payments: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    amount: true,
                    paymentDate: true,
                    method: true,
                    isReservation: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: { id: 'asc' },
            }),
      ]);

      // Aggregate customer order history across all non-deleted transactions
      const byCustomerName = new Map<
        string,
        {
          customerName: string;
          customerId: number | null;
          firstTransactionId: number;
          firstOrderDate: string | null;
          firstOrderTimestamp: number;
          firstCreatedAt: string;
          latestOrderDate: string | null;
          totalOrders: number;
          activeOrPaidOrders: number;
          cancelledOrders: number;
          totalGrossSpend: number;
          totalPaymentsRecorded: number;
          outstandingBalance: number;
        }
      >();

      for (const tx of txRows) {
        const rawName = (tx.customers ?? '').trim();
        if (!rawName) {
          continue;
        }
        const key = rawName.toLowerCase();
        const parsedOrderDate = parseDate(tx.orderDate);
        const orderTs =
          parsedOrderDate?.getTime() ??
          (tx.createdAt instanceof Date
            ? tx.createdAt.getTime()
            : Number.MAX_SAFE_INTEGER);
        const createdIso =
          tx.createdAt instanceof Date
            ? tx.createdAt.toISOString()
            : String(tx.createdAt ?? '');

        const qty = Number(tx.quantity ?? 0);
        const price = Number(tx.unitPrice ?? 0);
        const gross = Number(
          (
            qty * price -
            (unit === 'general-merchandise' ? Number(tx.discount ?? 0) : 0)
          ).toFixed(2)
        );
        const adj = Number(tx.adjustment ?? 0);
        const lineTotal = Number(tx.lineTotal ?? 0);
        const closed =
          unit === 'clothing' && isCancelledOrderStatus(tx.orderStatus ?? '');

        const existing = byCustomerName.get(key) ?? {
          customerName: rawName,
          customerId: (tx.customerId as number | null) ?? null,
          firstTransactionId: tx.id,
          firstOrderDate: tx.orderDate ?? null,
          firstOrderTimestamp: orderTs,
          firstCreatedAt: createdIso,
          latestOrderDate: tx.orderDate ?? null,
          totalOrders: 0,
          activeOrPaidOrders: 0,
          cancelledOrders: 0,
          totalGrossSpend: 0,
          totalPaymentsRecorded: 0,
          outstandingBalance: 0,
        };

        existing.totalOrders += 1;
        if (closed) {
          existing.cancelledOrders += 1;
        } else {
          existing.activeOrPaidOrders += 1;
          existing.totalGrossSpend = Number(
            (existing.totalGrossSpend + gross).toFixed(2)
          );
          existing.totalPaymentsRecorded = Number(
            (existing.totalPaymentsRecorded + adj).toFixed(2)
          );
          existing.outstandingBalance = Number(
            (existing.outstandingBalance + Math.max(0, lineTotal)).toFixed(2)
          );
        }

        if (orderTs < existing.firstOrderTimestamp) {
          existing.firstOrderTimestamp = orderTs;
          existing.firstOrderDate = tx.orderDate ?? null;
          existing.firstTransactionId = tx.id;
          existing.firstCreatedAt = createdIso;
        }
        existing.latestOrderDate = tx.orderDate ?? existing.latestOrderDate;
        if (!existing.customerId && tx.customerId) {
          existing.customerId = Number(tx.customerId);
        }

        byCustomerName.set(key, existing);
      }

      const customerOrderStats = Array.from(byCustomerName.values());
      customerOrderStats.sort((a, b) => {
        if (sortBy === 'highest_spend') {
          return b.totalGrossSpend - a.totalGrossSpend;
        }
        if (sortBy === 'most_orders') {
          return b.totalOrders - a.totalOrders;
        }
        if (sortBy === 'newest') {
          return (
            b.firstOrderTimestamp - a.firstOrderTimestamp ||
            b.firstTransactionId - a.firstTransactionId
          );
        }
        return (
          a.firstOrderTimestamp - b.firstOrderTimestamp ||
          a.firstTransactionId - b.firstTransactionId
        );
      });

      const matchingTransactions = search
        ? txRows.slice(0, 25).map((tx) => ({
            transactionId: tx.id,
            customer: tx.customers,
            productCode: tx.productCode,
            orderDate: tx.orderDate,
            orderStatus: tx.orderStatus,
            quantity: tx.quantity,
            unitPrice: tx.unitPrice,
            discount: tx.discount,
            adjustment: tx.adjustment,
            lineTotal: tx.lineTotal,
            payments: tx.payments ?? [],
          }))
        : undefined;

      return {
        businessUnit: unit,
        sortBy,
        search,
        totalRegisteredCustomerRecords: totalRegisteredCount,
        totalDistinctOrderingCustomers: customerOrderStats.length,
        registeredCustomersFromDirectory: registeredRows.map((c) => ({
          id: c.id,
          customerName: c.customerName,
          businessName: c.businessName,
          dateRegisteredField: c.date,
          createdAt:
            c.createdAt instanceof Date
              ? c.createdAt.toISOString()
              : String(c.createdAt ?? ''),
          customerStatus: c.customerStatus,
          phoneNumber: c.phoneNumber,
        })),
        customersByOrderHistory: customerOrderStats
          .slice(0, limit)
          .map(({ firstOrderTimestamp: _ts, ...rest }) => rest),
        ...(matchingTransactions ? { matchingTransactions } : {}),
        sourceLink:
          unit === 'general-merchandise'
            ? '/general-merchandise/operations/customers'
            : '/clothing/operations/customers',
      };
    },
  },
  {
    name: 'queryDatabaseReadOnly',
    description: [
      'Read-only PostgreSQL SELECT explorer tool for answering custom or ad-hoc analytical questions about business records when a pre-built summary tool is not specific enough.',
      'STRICT RULES:',
      '1. Only a single SELECT (or WITH ... SELECT) query is allowed. Never include semicolons, comments, or write/administrative commands.',
      '2. Always quote camelCase column names and mixed-case table names with double quotes in PostgreSQL!',
      '3. Schema quick-reference by businessUnit:',
      '   - clothing (public schema):',
      '     * "Customer" ("id", "customerName", "date", "phoneNumber", "businessName", "customerStatus", "createdAt", "deletedAt")',
      '     * transactions ("id", "orderDate", "customers", "customerId", "productCode", "productId", "quantity", "unitPrice", "discount", "adjustment", "lineTotal", "orderStatus", "invoiceDate", "packedDate", "shippedAt", "accountsReceivableDueAt", "shipmentCode", "createdAt", "deletedAt")',
      '     * transaction_payments ("id", "transactionId", "paymentDate", "amount", "method", "notes", "isReservation", "createdAt", "deletedAt")',
      '     * transaction_refunds ("id", "transactionId", "refundDate", "amount", "reason", "notes", "createdAt", "deletedAt")',
      '     * clothing_order_cancellations ("id", "transactionId", "kind", "decisionDate", "reason", "grossAmount", "collectedAmount", "approvedRefundAmount", "pendingAmount", "retainedAmount", "createdAt")',
      '     * products ("id", "productCode", "product", "shipmentCode", "shipmentStatus", "quantity", "unitPrice", "actualPrice", "landedUnitCost", "deletedAt")',
      '     * expenses ("id", "date", "amount", "description", "category", "status", "employeeName", "paymentMethod", "deletedAt")',
      '     * "ClothingAccountingOpeningBalance" ("id", "date", "ref", "account", "debit", "credit", "description", "deletedAt")',
      '     * clothing_accounting_journal_lines ("id", "date", "ref", "account", "debit", "credit", "description", "sourceType", "sourceId", "deletedAt")',
      '     * clothing_recurring_payment_templates ("id", "name", "kind", "amount", "frequency", "dayOfMonth", "nextDueDate", "isActive")',
      '     * clothing_recurring_payment_drafts ("id", "templateId", "dueDate", "amount", "status", "ref", "description")',
      '     * employees ("id", "employeeId", "name", "department", "position", "status", "deletedAt"), schedules, attendance, leave_requests, payrolls',
      '   - trucking (public schema):',
      '     * trucking_trips ("id", "date", "truckId", "driver", "helper", "destination", "totalExpenses", "customerId", "invoiceId", "status", "deletedAt")',
      '     * trucking_invoices ("id", "customerId", "totalAmount", "status", "dueDate", "createdAt")',
      '     * trucking_payments ("id", "customerId", "amount", "paymentDate", "method")',
      '     * trucking_expenses ("id", "date", "amount", "category", "description", "status")',
      '   - general-merchandise (general_merchandise schema — prefix tables with general_merchandise., e.g. general_merchandise.transactions, general_merchandise.customers, general_merchandise.products).',
    ].join('\n'),
    businessUnits: ['clothing', 'trucking', 'general-merchandise'],
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        businessUnit: {
          type: 'string',
          description: 'Business unit whose tables are being queried',
          enum: ['clothing', 'trucking', 'general-merchandise'],
        },
        sqlQuery: {
          type: 'string',
          description:
            'Single read-only PostgreSQL SELECT query using double quotes around camelCase columns (e.g., SELECT "id", "customers", "lineTotal" FROM transactions WHERE "deletedAt" IS NULL ORDER BY "id" DESC LIMIT 10).',
        },
        limit: {
          type: 'number',
          description: 'Maximum rows to return (1 to 25, default 15)',
        },
      },
      required: ['businessUnit', 'sqlQuery'],
    },
    execute: async (args, context) => {
      const unit = normalizeBusinessUnitArg(args.businessUnit);
      assertBusinessUnitAccessLocal(context, unit);

      const rawSql = typeof args.sqlQuery === 'string' ? args.sqlQuery : '';
      const maxRows = Math.min(25, Math.max(1, Number(args.limit) || 15));
      const boundedSql = validateAndBoundReadOnlySql(rawSql, unit, maxRows);

      type TxClient = {
        $executeRawUnsafe: (sql: string) => Promise<unknown>;
        $queryRawUnsafe: (sql: string) => Promise<unknown[]>;
      };

      const runReadOnlyQuery = async (): Promise<unknown[]> => {
        const maybeTransaction = Reflect.get(prisma, '$transaction');
        if (typeof maybeTransaction === 'function') {
          return (await (
            maybeTransaction as (
              fn: (tx: TxClient) => Promise<unknown[]>
            ) => Promise<unknown[]>
          ).call(prisma, async (tx: TxClient) => {
            await tx.$executeRawUnsafe('SET LOCAL TRANSACTION READ ONLY');
            await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 3000');
            return await tx.$queryRawUnsafe(boundedSql);
          })) as unknown[];
        }

        const maybeQueryRawUnsafe = Reflect.get(prisma, '$queryRawUnsafe');
        if (typeof maybeQueryRawUnsafe === 'function') {
          return (await (
            maybeQueryRawUnsafe as (sql: string) => Promise<unknown[]>
          ).call(prisma, boundedSql)) as unknown[];
        }

        throw new Error('Database raw query interface is unavailable.');
      };

      try {
        const rows = await runReadOnlyQuery();
        const serializedRows = (Array.isArray(rows) ? rows : []).map(
          serializeSqlValue
        );
        return {
          businessUnit: unit,
          rowCount: serializedRows.length,
          rows: serializedRows,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Database query execution failed';
        return {
          businessUnit: unit,
          error: message,
          hint: 'Verify table and column names (remember to wrap camelCase columns like "customerName", "orderDate", "deletedAt", "transactionId" and mixed-case tables like "Customer" or "ClothingAccountingOpeningBalance" in double quotes) and retry.',
        };
      }
    },
  },
];
