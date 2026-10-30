import { prisma } from '@/lib/db';
import type { AiBusinessUnit, AiToolDefinition } from '../types';
import {
  normalizeBusinessUnitArg,
  assertBusinessUnitAccessLocal,
} from './investigative-access';

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

export const DATABASE_READ_ONLY_TOOL: AiToolDefinition = {
  name: 'queryDatabaseReadOnly',
  description: [
    'Read-only PostgreSQL SELECT explorer tool for answering custom or ad-hoc analytical questions about business records when a pre-built summary tool is not specific enough.',
    'STRICT RULES:',
    '1. Only a single SELECT (or WITH ... SELECT) query is allowed. Never include semicolons, comments, or write/administrative commands.',
    '2. Always quote camelCase column names and mixed-case table names with double quotes in PostgreSQL!',
    'For product or order lookups, select the product name and complete "productCode" where available; preserve the full code including all suffixes in the answer, not the database product ID.',
    '3. Schema quick-reference by businessUnit:',
    '   - clothing (public schema):',
    '     * "Customer" ("id", "customerName", "date", "phoneNumber", "address", "businessAddress", "businessName", "customerStatus", "createdAt", "deletedAt")',
    '     * additional_customer_info ("id", "customerId", "type", "value", "deletedAt"); active alternate addresses have "type" = \'address\' and "deletedAt" IS NULL. Use findCustomersByAddress for ranked partial-address candidates, not an exact full-address substring.',
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
    '   - general-merchandise (general_merchandise schema — prefix tables with general_merchandise., e.g. general_merchandise.transactions, general_merchandise.customers, general_merchandise.products). customers also has "address" and "businessAddress"; additional_customer_info has "customerId", "type", "value", "deletedAt" for alternate addresses. Keep these records separate from Clothing.',
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
        err instanceof Error ? err.message : 'Database query execution failed';
      return {
        businessUnit: unit,
        error: message,
        hint: 'Verify table and column names (remember to wrap camelCase columns like "customerName", "orderDate", "deletedAt", "transactionId" and mixed-case tables like "Customer" or "ClothingAccountingOpeningBalance" in double quotes) and retry.',
      };
    }
  },
};
