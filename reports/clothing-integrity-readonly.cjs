// Read-only audit of the explicitly identified local development database.
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const settings = dotenv.parse(fs.readFileSync(path.join(root, '.env.local')));
const target = new URL(settings.DATABASE_URL);
if (target.hostname !== 'localhost' || target.port !== '5435' || target.pathname !== '/business_management') {
  throw new Error('Audit is restricted to the identified development database.');
}
const client = new PrismaClient({ datasources: { db: { url: settings.DATABASE_URL } } });
const queries = {
  schema: `SELECT to_regclass('public.clothing_accounting_opening_balances') IS NOT NULL AS opening_balance_table, to_regclass('public.clothing_supplier_credits') IS NOT NULL AS supplier_credit_table`,
  counts: `SELECT (SELECT count(*) FROM products WHERE "deletedAt" IS NULL) AS products, (SELECT count(*) FROM shipments WHERE "deletedAt" IS NULL) AS shipments, (SELECT count(*) FROM transactions WHERE "deletedAt" IS NULL) AS transactions, (SELECT count(*) FROM inventory_movements WHERE "deletedAt" IS NULL) AS movements`,
  duplicate_products: `SELECT lower(btrim("productCode")) AS code, array_agg(id ORDER BY id) AS ids FROM products WHERE "deletedAt" IS NULL AND nullif(btrim("productCode"),'') IS NOT NULL GROUP BY 1 HAVING count(*) > 1`,
  duplicate_shipments: `SELECT lower(btrim("shipmentCode")) AS code, array_agg(id ORDER BY id) AS ids FROM shipments WHERE "deletedAt" IS NULL GROUP BY 1 HAVING count(*) > 1`,
  payment_mismatch: `WITH sums AS (SELECT "transactionId", sum(amount) AS paid FROM transaction_payments WHERE "deletedAt" IS NULL GROUP BY 1) SELECT count(*) AS affected, coalesce(sum(abs(t.adjustment-coalesce(s.paid,0))),0) AS absolute_difference FROM transactions t LEFT JOIN sums s ON s."transactionId"=t.id WHERE t."deletedAt" IS NULL AND abs(t.adjustment-coalesce(s.paid,0)) > 0.01`,
  line_total_mismatch: `SELECT count(*) AS affected FROM transactions WHERE "deletedAt" IS NULL AND lower(coalesce("orderStatus",'')) NOT IN ('cancelled','canceled','voided','forfeited') AND abs("lineTotal"-(quantity*"unitPrice"-adjustment)) > 0.01`,
  deleted_orders_with_active_movements: `SELECT count(DISTINCT t.id) AS orders, count(*) AS movements FROM inventory_movements m JOIN transactions t ON t.id=m."sourceTransactionId" WHERE t."deletedAt" IS NOT NULL AND m."deletedAt" IS NULL`,
  deleted_orders_with_money: `SELECT count(*) AS orders FROM transactions t WHERE t."deletedAt" IS NOT NULL AND (EXISTS(SELECT 1 FROM transaction_payments p WHERE p."transactionId"=t.id AND p."deletedAt" IS NULL) OR EXISTS(SELECT 1 FROM transaction_refunds r WHERE r."transactionId"=t.id AND r."deletedAt" IS NULL))`,
  missing_shipment_links: `SELECT count(*) AS products FROM products p WHERE p."deletedAt" IS NULL AND nullif(btrim(p."shipmentCode"),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shipments s WHERE s."deletedAt" IS NULL AND lower(btrim(s."shipmentCode"))=lower(btrim(p."shipmentCode")))`,
  unresolved_product_identity: `SELECT count(*) AS orders FROM transactions WHERE "deletedAt" IS NULL AND "productId" IS NULL AND nullif(btrim("productCode"),'') IS NOT NULL`,
  negative_sellable_ledger: `WITH balances AS (SELECT lower(btrim("productCode")) AS code, sum(CASE WHEN "toBucket"='sellable' THEN quantity ELSE 0 END)-sum(CASE WHEN "fromBucket"='sellable' THEN quantity ELSE 0 END) AS quantity, bool_or("toBucket"='sellable' AND "fromBucket"<>'sellable') AS receipt FROM inventory_movements WHERE "deletedAt" IS NULL GROUP BY 1) SELECT count(*) AS product_codes, coalesce(sum(quantity),0) AS net_negative_quantity FROM balances WHERE receipt AND quantity < -0.000001`,
  uncosted_sales: `SELECT count(*) AS movements FROM inventory_movements WHERE "deletedAt" IS NULL AND "toBucket"='sold' AND ("unitCost" IS NULL OR "unitCost" <= 0)`,
  shipment_status_disagreement: `SELECT count(*) AS products FROM products p JOIN shipments s ON p."shipmentCode"=s."shipmentCode" AND s."deletedAt" IS NULL WHERE p."deletedAt" IS NULL AND lower(coalesce(p."shipmentStatus",''))<>lower(s."shipmentStatus")`,
  payment_mismatch_breakdown: `WITH sums AS (SELECT "transactionId", sum(amount) AS paid FROM transaction_payments WHERE "deletedAt" IS NULL GROUP BY 1) SELECT CASE WHEN t.adjustment>coalesce(s.paid,0) THEN 'order_paid_exceeds_events' ELSE 'events_exceed_order_paid' END AS direction, count(*) AS orders, sum(abs(t.adjustment-coalesce(s.paid,0))) AS absolute_difference FROM transactions t LEFT JOIN sums s ON s."transactionId"=t.id WHERE t."deletedAt" IS NULL AND abs(t.adjustment-coalesce(s.paid,0)) > 0.01 GROUP BY 1`,
  missing_shipment_codes: `SELECT p."shipmentCode" AS code, count(*) AS products FROM products p WHERE p."deletedAt" IS NULL AND nullif(btrim(p."shipmentCode"),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shipments s WHERE s."deletedAt" IS NULL AND lower(btrim(s."shipmentCode"))=lower(btrim(p."shipmentCode"))) GROUP BY 1 ORDER BY 1`,
  unresolved_product_identity_breakdown: `SELECT CASE WHEN EXISTS(SELECT 1 FROM bundle_batches b WHERE lower(b."bundleSku")=lower(t."productCode")) THEN 'bundle_or_mix' WHEN EXISTS(SELECT 1 FROM split_batch_components s WHERE lower(s."componentSku")=lower(t."productCode")) THEN 'split_child' ELSE 'unresolved_other' END AS kind, count(*) AS orders FROM transactions t WHERE t."deletedAt" IS NULL AND t."productId" IS NULL AND nullif(btrim(t."productCode"),'') IS NOT NULL GROUP BY 1`,
  uncosted_sales_fallback: `SELECT count(*) AS movements, count(*) FILTER (WHERE EXISTS(SELECT 1 FROM products p WHERE p."deletedAt" IS NULL AND p."productCode"=m."productCode" AND (p."landedUnitCost">0 OR (p.cogs>0 AND p.quantity>0)))) AS with_current_product_cost FROM inventory_movements m WHERE m."deletedAt" IS NULL AND m."toBucket"='sold' AND (m."unitCost" IS NULL OR m."unitCost"<=0)`,
  deleted_money_orders: `SELECT t.id, t."orderStatus", (SELECT coalesce(sum(p.amount),0) FROM transaction_payments p WHERE p."transactionId"=t.id AND p."deletedAt" IS NULL) AS payments, (SELECT coalesce(sum(r.amount),0) FROM transaction_refunds r WHERE r."transactionId"=t.id AND r."deletedAt" IS NULL) AS refunds FROM transactions t WHERE t."deletedAt" IS NOT NULL AND (EXISTS(SELECT 1 FROM transaction_payments p WHERE p."transactionId"=t.id AND p."deletedAt" IS NULL) OR EXISTS(SELECT 1 FROM transaction_refunds r WHERE r."transactionId"=t.id AND r."deletedAt" IS NULL))`,
};
(async () => {
  const report = { generatedAt: new Date().toISOString(), target: 'local development localhost:5435/business_management', readOnly: true, checks: {} };
  try {
    for (const [name, query] of Object.entries(queries)) {
      try {
        report.checks[name] = await client.$transaction(async tx => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          return tx.$queryRawUnsafe(query);
        }, { timeout: 30000 });
      } catch (error) {
        report.checks[name] = { error: error.code || error.name, detail: error.meta?.message || 'Query could not complete' };
      }
    }
    const output = JSON.stringify(report, (_, value) => typeof value === 'bigint' ? Number(value) : value, 2);
    fs.writeFileSync(path.join(__dirname, 'clothing-integrity-data-2026-10-27.json'), output + '\n');
    console.log(output);
  } finally { await client.$disconnect(); }
})();
