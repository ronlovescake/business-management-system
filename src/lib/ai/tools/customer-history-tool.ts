import { prisma } from '@/lib/db';
import type { AiToolDefinition } from '../types';
import {
  normalizeBusinessUnitArg,
  assertBusinessUnitAccessLocal,
} from './investigative-access';
import { parseDate } from '@/lib/accounting/date-utils';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';

export const CUSTOMER_HISTORY_TOOL: AiToolDefinition = {
  name: 'queryCustomersAndOrderHistory',
  description:
    'Read-only customer intelligence tool that looks up customers and their order/payment history for a business unit. Use this to answer questions like "Who is our oldest customer?", "Who are our newest or top-spending customers?", or to inspect a specific customer’s orders and payment records. For delivery or waybill address matching use findCustomersByAddress instead; this tool searches customer names, phone and business names, not addresses.',
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
      orderLimit: {
        type: 'number',
        description:
          'Maximum matching order rows to return (1 to 100, default 100). Results explicitly report truncation.',
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
        const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
        existing.totalPaid = Number((existing.totalPaid + paid).toFixed(2));
        const invDate = inv.createdAt.toISOString();
        if (!existing.firstInvoiceDate || invDate < existing.firstInvoiceDate) {
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
          findMany?: (args: unknown) => Promise<Array<Record<string, unknown>>>;
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
              product: { select: { product: true } },
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
              product: { select: { product: true } },
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

    const requestedOrderLimit = Number(args.orderLimit);
    const orderLimit = Number.isFinite(requestedOrderLimit)
      ? Math.min(100, Math.max(1, Math.floor(requestedOrderLimit)))
      : 100;
    const matchingTransactions = search
      ? txRows.slice(0, orderLimit).map((tx) => ({
          transactionId: tx.id,
          customerId: tx.customerId,
          customer: tx.customers,
          product: tx.product?.product ?? null,
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
      ...(matchingTransactions
        ? {
            matchingTransactions,
            matchingTransactionCount: txRows.length,
            returnedTransactionCount: matchingTransactions.length,
            hasMoreTransactions: txRows.length > matchingTransactions.length,
          }
        : {}),
      sourceLink:
        unit === 'general-merchandise'
          ? '/general-merchandise/operations/customers'
          : '/clothing/operations/customers',
    };
  },
};
