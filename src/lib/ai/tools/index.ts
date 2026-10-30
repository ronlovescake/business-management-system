import { prisma } from '@/lib/db';
import {
  CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import type {
  AiBusinessUnit,
  AiToolDefinition,
  AiToolExecutionContext,
} from '../types';

const EPS = 0.01;

export function resolveAllowedBusinessUnits(
  userRole: string | null,
  accessibleModules: string[]
): AiBusinessUnit[] {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
    return ['clothing', 'trucking', 'general-merchandise'];
  }

  const units = new Set<AiBusinessUnit>();
  for (const modPath of accessibleModules) {
    if (modPath.startsWith('/clothing')) {
      units.add('clothing');
    }
    if (modPath.startsWith('/trucking')) {
      units.add('trucking');
    }
    if (modPath.startsWith('/general-merchandise')) {
      units.add('general-merchandise');
    }
  }
  return Array.from(units);
}

export function assertBusinessUnitAccess(
  context: AiToolExecutionContext,
  businessUnit: AiBusinessUnit
): void {
  if (!context.allowedBusinessUnits.includes(businessUnit)) {
    throw new Error(
      `Access denied: current user is not authorized to read ${businessUnit} records.`
    );
  }
}

function normalizeBusinessUnitArg(raw: unknown): AiBusinessUnit {
  if (raw === 'trucking' || raw === 'general-merchandise') {
    return raw;
  }
  return 'clothing';
}

export const READ_ONLY_BUSINESS_TOOLS: readonly AiToolDefinition[] = [
  {
    name: 'getOverdueInvoicesAndReceivables',
    description:
      'Read-only tool that returns overdue invoices, pending-payment orders, and accounts receivable balances with deterministic aging and payment totals for a specific business unit.',
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
        limit: {
          type: 'number',
          description: 'Maximum rows to return (1 to 30)',
        },
      },
      required: ['businessUnit'],
    },
    execute: async (args, context) => {
      const unit = normalizeBusinessUnitArg(args.businessUnit);
      assertBusinessUnitAccess(context, unit);
      const take = Math.min(30, Math.max(1, Number(args.limit) || 15));
      const now = new Date();

      if (unit === 'trucking') {
        const invoices = await prisma.truckingInvoice.findMany({
          where: {
            status: { in: ['DRAFT', 'SENT', 'PARTIAL'] },
          },
          include: {
            customer: { select: { id: true, customerName: true } },
            allocations: { select: { amount: true } },
          },
          orderBy: { dueDate: 'asc' },
          take,
        });

        const items = invoices.map((inv) => {
          const total = Number(inv.totalAmount);
          const paid = inv.allocations.reduce(
            (sum: number, a: { amount: unknown }) => sum + Number(a.amount),
            0
          );
          const balance = Number((total - paid).toFixed(2));
          const isOverdue = Boolean(inv.dueDate && inv.dueDate < now);
          return {
            invoiceId: inv.id,
            customerName: inv.customer.customerName,
            status: inv.status,
            dueDate: inv.dueDate
              ? inv.dueDate.toISOString().slice(0, 10)
              : null,
            totalAmount: total,
            paidAmount: Number(paid.toFixed(2)),
            remainingBalance: balance,
            isOverdue,
            sourceLink: '/trucking/operations/trips',
          };
        });

        return {
          businessUnit: 'trucking',
          count: items.length,
          overdueCount: items.filter((i) => i.isOverdue).length,
          items,
        };
      }

      if (unit === 'general-merchandise') {
        const rows = await prisma.generalMerchandiseTransaction.findMany({
          where: {
            deletedAt: null,
            orderStatus: 'Pending Payment',
          },
          include: {
            payments: {
              where: { deletedAt: null },
              select: { amount: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take,
        });

        const items = rows.map((tx) => {
          const gross = Number(
            (
              (tx.quantity ?? 0) * (tx.unitPrice ?? 0) -
              (tx.discount ?? 0)
            ).toFixed(2)
          );
          const paid = tx.payments.reduce(
            (s: number, p: { amount: number | null }) => s + (p.amount ?? 0),
            0
          );
          return {
            transactionId: tx.id,
            customer: tx.customers ?? 'Unknown',
            productCode: tx.productCode ?? '',
            orderDate: tx.orderDate ?? '',
            orderStatus: tx.orderStatus ?? '',
            dueAt: tx.invoiceDate ?? tx.orderDate ?? null,
            grossAmount: gross,
            recordedPayments: Number(paid.toFixed(2)),
            outstandingBalance: Number(Math.max(0, gross - paid).toFixed(2)),
            sourceLink: '/general-merchandise/operations/transactions',
          };
        });

        return {
          businessUnit: 'general-merchandise',
          count: items.length,
          items,
        };
      }

      const rows = await prisma.transaction.findMany({
        where: {
          deletedAt: null,
          OR: [
            { orderStatus: { in: [...CLOTHING_ACCOUNTS_RECEIVABLE_STATUSES] } },
            { accountsReceivableDueAt: { lt: now } },
          ],
        },
        include: {
          payments: {
            where: { deletedAt: null },
            select: { amount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });

      const items = rows.map((tx) => {
        const gross = Number(
          (
            (tx.quantity ?? 0) * (tx.unitPrice ?? 0) -
            (tx.discount ?? 0)
          ).toFixed(2)
        );
        const paid = tx.payments.reduce((s, p) => s + (p.amount ?? 0), 0);
        return {
          transactionId: tx.id,
          customer: tx.customers ?? 'Unknown',
          productCode: tx.productCode ?? '',
          orderDate: tx.orderDate ?? '',
          orderStatus: tx.orderStatus ?? '',
          dueAt: tx.accountsReceivableDueAt
            ? tx.accountsReceivableDueAt.toISOString().slice(0, 10)
            : null,
          grossAmount: gross,
          recordedPayments: Number(paid.toFixed(2)),
          outstandingBalance: Number(Math.max(0, gross - paid).toFixed(2)),
          sourceLink: '/clothing/operations/transactions',
        };
      });

      return {
        businessUnit: 'clothing',
        count: items.length,
        items,
      };
    },
  },
  {
    name: 'getAccountingDiscrepancies',
    description:
      'Read-only deterministic audit tool that detects paid orders with non-zero line balances, missing amounts, or payment-vs-invoice mismatches.',
    businessUnits: ['clothing', 'trucking', 'general-merchandise'],
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        businessUnit: {
          type: 'string',
          description: 'Business domain to audit',
          enum: ['clothing', 'trucking', 'general-merchandise'],
        },
        limit: {
          type: 'number',
          description: 'Max anomalies to return (1 to 30)',
        },
      },
      required: ['businessUnit'],
    },
    execute: async (args, context) => {
      const unit = normalizeBusinessUnitArg(args.businessUnit);
      assertBusinessUnitAccess(context, unit);
      const maxRows = Math.min(30, Math.max(1, Number(args.limit) || 20));

      if (unit === 'trucking') {
        const paidInvoices = await prisma.truckingInvoice.findMany({
          where: { status: 'PAID' },
          include: {
            customer: { select: { customerName: true } },
            allocations: { select: { amount: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        });

        const anomalies = [];
        for (const inv of paidInvoices) {
          const total = Number(inv.totalAmount);
          const allocated = inv.allocations.reduce(
            (s: number, a: { amount: unknown }) => s + Number(a.amount),
            0
          );
          const diff = Number((total - allocated).toFixed(2));
          if (Math.abs(diff) > EPS) {
            anomalies.push({
              invoiceId: inv.id,
              customer: inv.customer.customerName,
              status: inv.status,
              invoiceTotal: total,
              allocatedPayments: Number(allocated.toFixed(2)),
              discrepancyAmount: diff,
              issue:
                'Invoice is marked PAID but allocated payments do not equal invoice total.',
              sourceLink: '/trucking/operations/trips',
            });
          }
          if (anomalies.length >= maxRows) {
            break;
          }
        }

        return {
          businessUnit: 'trucking',
          anomalyCount: anomalies.length,
          anomalies,
        };
      }

      const paidStatuses: string[] = [...PAID_STATUSES, 'Paid'];
      const rows =
        unit === 'general-merchandise'
          ? await prisma.generalMerchandiseTransaction.findMany({
              where: { deletedAt: null },
              orderBy: { id: 'desc' },
              take: 250,
            })
          : await prisma.transaction.findMany({
              where: { deletedAt: null },
              orderBy: { id: 'desc' },
              take: 250,
            });

      const anomalies = [];
      const link =
        unit === 'general-merchandise'
          ? '/general-merchandise/operations/transactions'
          : '/clothing/operations/transactions';

      for (const tx of rows) {
        const qty = Number(tx.quantity ?? 0);
        const price = Number(tx.unitPrice ?? 0);
        const gross = Number(
          (qty * price - Number(tx.discount ?? 0)).toFixed(2)
        );
        const adj = Number(tx.adjustment ?? 0);
        const lineTotal = Number(tx.lineTotal ?? 0);
        const expectedLineTotal = Number((gross - adj).toFixed(2));
        const status = (tx.orderStatus || '').trim();

        if (paidStatuses.includes(status) && Math.abs(lineTotal) > EPS) {
          anomalies.push({
            transactionId: tx.id,
            customer: tx.customers ?? 'Unknown',
            productCode: tx.productCode ?? '',
            orderStatus: status,
            grossSale: gross,
            adjustment: adj,
            lineTotal,
            discrepancyAmount: lineTotal,
            issue: `Order is marked "${status}" but remaining lineTotal is ₱${lineTotal.toFixed(2)} instead of ₱0.00.`,
            sourceLink: link,
          });
        } else if (Math.abs(lineTotal - expectedLineTotal) > EPS) {
          anomalies.push({
            transactionId: tx.id,
            customer: tx.customers ?? 'Unknown',
            productCode: tx.productCode ?? '',
            orderStatus: status,
            grossSale: gross,
            adjustment: adj,
            lineTotal,
            expectedLineTotal,
            discrepancyAmount: Number(
              (lineTotal - expectedLineTotal).toFixed(2)
            ),
            issue: `Recorded lineTotal (₱${lineTotal.toFixed(2)}) does not match deterministic formula grossSale - adjustment (₱${expectedLineTotal.toFixed(2)}).`,
            sourceLink: link,
          });
        }

        if (anomalies.length >= maxRows) {
          break;
        }
      }

      return {
        businessUnit: unit,
        anomalyCount: anomalies.length,
        anomalies,
      };
    },
  },
  {
    name: 'getUpcomingRecurringObligations',
    description:
      'Read-only tool returning upcoming or overdue recurring payment templates and drafts (loans, rent, utilities) for clothing or general-merchandise.',
    businessUnits: ['clothing', 'general-merchandise'],
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        businessUnit: {
          type: 'string',
          description: 'Business unit (clothing or general-merchandise)',
          enum: ['clothing', 'general-merchandise'],
        },
      },
      required: ['businessUnit'],
    },
    execute: async (args, context) => {
      const unit =
        args.businessUnit === 'general-merchandise'
          ? 'general-merchandise'
          : 'clothing';
      assertBusinessUnitAccess(context, unit);

      const templates =
        unit === 'general-merchandise'
          ? await prisma.generalMerchandiseRecurringPaymentTemplate.findMany({
              where: { isActive: true },
              include: {
                drafts: {
                  where: { status: 'DRAFT' },
                  orderBy: { dueDate: 'asc' },
                  take: 5,
                },
              },
              orderBy: { nextDueDate: 'asc' },
              take: 25,
            })
          : await prisma.clothingRecurringPaymentTemplate.findMany({
              where: { isActive: true },
              include: {
                drafts: {
                  where: { status: 'DRAFT' },
                  orderBy: { dueDate: 'asc' },
                  take: 5,
                },
              },
              orderBy: { nextDueDate: 'asc' },
              take: 25,
            });

      return {
        businessUnit: unit,
        count: templates.length,
        items: templates.map((t) => ({
          id: t.id,
          name: t.name,
          kind: t.kind,
          amount: t.amount,
          frequency: t.frequency,
          nextDueDate: t.nextDueDate.toISOString().slice(0, 10),
          pendingDraftCount: t.drafts.length,
          sourceLink:
            unit === 'general-merchandise'
              ? '/general-merchandise/accounting'
              : '/clothing/accounting',
        })),
      };
    },
  },
  {
    name: 'getSchedulesAndEmployeeFollowUps',
    description:
      'Read-only tool returning upcoming employee schedules, pending leave requests, and pending cash advances for a business unit.',
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
      },
      required: ['businessUnit'],
    },
    execute: async (args, context) => {
      const unit = normalizeBusinessUnitArg(args.businessUnit);
      assertBusinessUnitAccess(context, unit);
      const todayIso = new Date().toISOString().slice(0, 10);

      if (unit === 'trucking') {
        const [schedules, leaves] = await Promise.all([
          prisma.truckingSchedule.findMany({
            where: { deletedAt: null, date: { gte: todayIso } },
            orderBy: { date: 'asc' },
            take: 15,
          }),
          prisma.truckingLeaveRequest.findMany({
            where: { deletedAt: null, status: 'pending' },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
        ]);
        return {
          businessUnit: 'trucking',
          upcomingSchedulesCount: schedules.length,
          pendingLeavesCount: leaves.length,
          schedules: schedules.map((s) => ({
            employeeName: s.employeeName,
            date: s.date,
            shiftType: s.shiftType,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
          })),
          pendingLeaves: leaves.map((l) => ({
            employeeName: l.employeeName,
            leaveType: l.leaveType,
            startDate: l.startDate,
            endDate: l.endDate,
            status: l.status,
          })),
        };
      }

      if (unit === 'general-merchandise') {
        const [schedules, leaves] = await Promise.all([
          prisma.generalMerchandiseSchedule.findMany({
            where: { deletedAt: null, date: { gte: todayIso } },
            orderBy: { date: 'asc' },
            take: 15,
          }),
          prisma.generalMerchandiseLeaveRequest.findMany({
            where: { deletedAt: null, status: 'pending' },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
        ]);
        return {
          businessUnit: 'general-merchandise',
          upcomingSchedulesCount: schedules.length,
          pendingLeavesCount: leaves.length,
          schedules: schedules.map((s) => ({
            employeeName: s.employeeName,
            date: s.date,
            shiftType: s.shiftType,
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
          })),
          pendingLeaves: leaves.map((l) => ({
            employeeName: l.employeeName,
            leaveType: l.leaveType,
            startDate: l.startDate,
            endDate: l.endDate,
            status: l.status,
          })),
        };
      }

      const [schedules, leaves] = await Promise.all([
        prisma.schedule.findMany({
          where: { deletedAt: null, date: { gte: todayIso } },
          orderBy: { date: 'asc' },
          take: 15,
        }),
        prisma.leaveRequest.findMany({
          where: { deletedAt: null, status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return {
        businessUnit: 'clothing',
        upcomingSchedulesCount: schedules.length,
        pendingLeavesCount: leaves.length,
        schedules: schedules.map((s) => ({
          employeeName: s.employeeName,
          date: s.date,
          shiftType: s.shiftType,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
        })),
        pendingLeaves: leaves.map((l) => ({
          employeeName: l.employeeName,
          leaveType: l.leaveType,
          startDate: l.startDate,
          endDate: l.endDate,
          status: l.status,
        })),
      };
    },
  },
];

export function getToolsForContext(
  context: AiToolExecutionContext,
  targetBusinessUnit?: AiBusinessUnit
): AiToolDefinition[] {
  return READ_ONLY_BUSINESS_TOOLS.filter((tool) => {
    const allowedUnits = tool.businessUnits.filter((u) =>
      context.allowedBusinessUnits.includes(u)
    );
    if (!allowedUnits.length) {
      return false;
    }
    if (targetBusinessUnit && !allowedUnits.includes(targetBusinessUnit)) {
      return false;
    }
    return true;
  });
}
