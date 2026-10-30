import { prisma } from '@/lib/db';
import type { AiToolDefinition } from '../types';
import {
  normalizeBusinessUnitArg,
  assertBusinessUnitAccessLocal,
} from './investigative-access';
import { reconcileClothingCash } from './clothing-cash-reconciliation';

const EPS = 0.01;

export const CASH_RECONCILIATION_TOOL: AiToolDefinition = {
  name: 'reconcileCashAndFindDiscrepancies',
  description:
    'Read-only scoped cash reconciliation. Cash means physical cash + bank + GCash/e-wallet recorded balances, not physical notes alone. Uses a supplied amount directly as a comparison input, without claiming it was independently counted. Clothing includes dated posted transit funding and a Products/build-up/journal-source completeness audit: missing Paid cash/bank/GCash purchase candidates, funding/settlement/credit/history conflicts, and explicit checked/not-verified coverage. Inspect purchasePostingCoverage before saying no explanation exists. Do not equate every inventory posting with cash or automatically adjust the ledger. Other domains retain their own supported scope.',
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
          'Optional user-supplied combined physical cash + bank + GCash/e-wallet amount to compare with recorded funds. Use directly; no repeated real-versus-test confirmation. This is not proof of an independently verified count.',
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
    return await reconcileClothingCash(actualCashAmount);
  },
};
