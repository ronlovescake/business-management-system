const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const root = path.resolve(__dirname, '../..');
const environment = dotenv.parse(fs.readFileSync(path.join(root, '.env.local')));
const target = new URL(environment.DATABASE_URL);
assert.equal(target.hostname, 'localhost');
assert.equal(target.port, '5435');
assert.equal(target.pathname, '/business_management');
const client = new PrismaClient({ datasources: { db: { url: environment.DATABASE_URL } } });
const operation = 'SIM-DUES-RECURRING-20261029';
const finalOperation = 'SIM-DUES-ESQUIRE3-FINAL-20261029';
const finalAmount = 11333.33;
const finalDate = '2026-10-25';
const expenseAccount = 'Monthly Dues Expense';
const container = 'business-management-system-dev-db-1';
const date = value => new Date(`${value}T00:00:00.000Z`);
const money = values => values.reduce((total, value) => total.plus(value), new Decimal(0)).toFixed(2);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const facilities = [
  { key: 'ggives', name: 'GGives', amount: 664.70, day: 13, next: '2026-11-13', end: '2027-03-13' },
  { key: 'esquire-2-14', name: 'Esquire 2 - 14th', amount: 5666.67, day: 14, next: '2026-11-14', end: '2027-08-14' },
  { key: 'banko', name: 'BanKo - MANUAL 14-day cycle', amount: 10230.77, day: 28, next: '2026-10-28', end: '2027-06-17', paused: true, reason: 'Unsupported 14-day frequency; nextDueDate retains last reported payment, NOT a verified next due. October 15/28 are 13 days apart. Confirm next actual due before any future generation.' },
  { key: 'bpi-card', name: 'BPI Credit Card', amount: 21500, day: 17, next: '2026-11-17', end: '2029-12-17' },
  { key: 'rcbc', name: 'RCBC Credit', amount: 6000, day: 19, next: '2026-11-19', end: '2028-01-19' },
  { key: 'esquire-1-23', name: 'Esquire 1 - 23rd', amount: 11333.33, day: 23, next: '2026-11-23', end: '2027-03-23' },
  { key: 'ggives-2', name: 'GGives 2', amount: 1282.84, day: 24, next: '2026-11-24', end: '2027-07-24' },
  { key: 'gloan-2', name: 'GLoan 2', amount: 5181, day: 26, next: '2026-11-26', end: '2027-12-26' },
  { key: 'esquire-1-8', name: 'Esquire 1 - 8th', amount: 11333.33, day: 8, next: '2026-11-08', end: '2027-04-08', reason: 'Same Esquire 1 facility as the 23rd rule. October 8 confirmed paid before cutover; no October cash posting.' },
  { key: 'esquire-2-29', name: 'Esquire 2 - 29th - REVIEW FEBRUARY', amount: 5666.67, day: 29, next: '2026-10-29', end: '2027-07-29', paused: true, reason: 'Same Esquire 2 facility as the 14th rule. October 29 is NOT confirmed paid. Automatic generation paused pending February/short-month policy; October 29 remains a draft.' },
];

const payments = [
  { key: 'ggives', day: '2026-10-13', ref: 'SIM-DUES-GGives', sourceId: '31b37544-7ba5-4d94-87e7-4106411ad671', account: 'Loan Payable \u2013 GGives' },
  { key: 'esquire-2-14', day: '2026-10-14', ref: 'SIM-DUES-Esquire 2', sourceId: 'abcd2ec3-b803-402d-ac63-77f5e4c49e31', account: 'Loan Payable \u2013 Esquire Loan 2' },
  { key: 'banko', day: '2026-10-15', ref: 'SIM-DUES-BPI BanKo Negosyo (reported Oct 15)', sourceId: 'a06af272-8ae6-4729-beaf-18cedb239b4a', account: 'Loan Payable \u2013 BPI BanKo Negosyo Loan' },
  { key: 'bpi-card', day: '2026-10-17', ref: 'SIM-DUES-BPI Credit Card', sourceId: 'b44181e7-ede5-4682-b381-2d349c0f6e6e', account: 'Credit Card Payable \u2013 BPI Credit Card' },
  { key: 'rcbc', day: '2026-10-19', ref: 'SIM-DUES-RCBC Credit', sourceId: 'd6e7fc35-58a5-4d71-bbdc-9b0b5c18e864', account: 'Loan Payable \u2013 RCBC Credit' },
  { key: 'esquire-1-23', day: '2026-10-23', ref: 'SIM-DUES-Esquire 1', sourceId: '1f708add-a4dd-462c-9ac9-f51fba4c6177', account: 'Loan Payable \u2013 Esquire Loan 1' },
  { key: 'ggives-2', day: '2026-10-24', ref: 'SIM-DUES-GGives 2', sourceId: '0f796604-1e12-4b8c-99d8-c381bf7d5262', account: 'Loan Payable \u2013 GGives 2' },
  { key: 'gloan-2', day: '2026-10-26', ref: 'SIM-DUES-GLoan 2', sourceId: '6c33712a-7194-4330-8693-cc261fd5254e', account: 'Loan Payable \u2013 GLoan 2' },
  { key: 'banko', day: '2026-10-28', ref: 'SIM-DUES-BPI BanKo Negosyo (reported Oct 28)', sourceId: '4ddc7cb4-480a-4b8d-ac3a-883fe3724fe0', account: 'Loan Payable \u2013 BPI BanKo Negosyo Loan' },
];
const facilityByKey = new Map(facilities.map(row => [row.key, row]));
assert.equal(money(payments.map(row => facilityByKey.get(row.key).amount)), '72090.08');
assert.equal(facilities.length, 10);

const protectedTables = [
  'accounting_settings', 'products', 'shipments', 'inventory_movements', 'transactions',
  'transaction_payments', 'transaction_refunds', 'clothing_order_cancellations',
  'clothing_refund_payouts', 'transaction_status_changes', 'expenses',
  'ClothingAccountingOpeningBalance', 'clothing_inventory_transit_build_entries',
  'clothing_inventory_reclass_entries', 'ClothingInvestmentAgreement', 'ClothingInvestmentPayment',
];

async function protect(transaction, scopeOperation = operation) {
  const hashes = {};
  for (const table of protectedTables) {
    const rows = await transaction.$queryRawUnsafe(`SELECT * FROM public."${table}" ORDER BY id`);
    hashes[table] = hash(rows);
  }
  const excludedRefs = [{ ref: { startsWith: `RECURRING:${scopeOperation}` } }];
  if (scopeOperation === operation) excludedRefs.push({ ref: { startsWith: 'SIM-DUES-' } });
  const unrelatedJournal = await transaction.clothingAccountingJournalLine.findMany({
    where: { NOT: excludedRefs }, orderBy: { id: 'asc' },
  });
  const oldTemplates = await transaction.clothingRecurringPaymentTemplate.findMany({ where: { NOT: { id: { startsWith: scopeOperation } } }, orderBy: { id: 'asc' } });
  const oldDrafts = await transaction.clothingRecurringPaymentDraft.findMany({ where: { NOT: { id: { startsWith: scopeOperation } } }, orderBy: { id: 'asc' } });
  return { ...hashes, unrelatedJournal: hash(unrelatedJournal), existingTemplates: hash(oldTemplates), existingDrafts: hash(oldDrafts) };
}

function verifiedBackup(manifestPath, expectedOperation = operation) {
  assert.ok(manifestPath, 'A verified backup manifest is required before any writes.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.operation, expectedOperation);
  assert.equal(manifest.target, 'localhost:5435/business_management');
  assert.equal(manifest.archiveVerified, true);
  assert.equal(fileHash(manifest.file), manifest.sha256);
  assert.ok(Date.now() - new Date(manifest.createdAt).getTime() < 24 * 60 * 60 * 1000, 'Backup must be less than 24 hours old.');
  return manifest;
}

async function backup(backupOperation = operation) {
  const inspect = spawnSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', container], { encoding: 'utf8' });
  assert.equal(inspect.status, 0, 'Cannot inspect the exact development container.');
  const ports = JSON.parse(inspect.stdout);
  assert.ok(ports['5432/tcp'].some(binding => binding.HostPort === '5435'));
  const directory = path.join(os.homedir(), 'bms-dev-backups');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const file = path.join(directory, `business_management_dev_pre-recurring-dues_${stamp}.dump`);
  const descriptor = fs.openSync(file, 'wx', 0o600);
  let dump;
  try {
    dump = spawnSync('docker', ['exec', container, 'pg_dump', '--no-password', '-U', decodeURIComponent(target.username), '-d', target.pathname.slice(1), '--format=custom', '--no-owner', '--no-acl'], { stdio: ['ignore', descriptor, 'pipe'] });
  } finally { fs.closeSync(descriptor); }
  assert.equal(dump.status, 0, 'Development backup failed; no data conversion is allowed.');
  assert.ok(fs.statSync(file).size > 10000);
  const input = fs.openSync(file, 'r');
  let listing;
  try {
    listing = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '--list'], { stdio: [input, 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } finally { fs.closeSync(input); }
  assert.equal(listing.status, 0, 'Backup archive listing failed.');
  for (const table of ['clothing_accounting_journal_lines', 'clothing_recurring_payment_templates', 'clothing_recurring_payment_drafts', 'inventory_movements', 'transaction_payments']) assert.ok(listing.stdout.includes(table), `Missing backup table: ${table}`);
  const manifest = { operation: backupOperation, target: 'localhost:5435/business_management', file, sha256: fileHash(file), bytes: fs.statSync(file).size, createdAt: new Date().toISOString(), archiveVerified: true, restorationRehearsed: false };
  const manifestPath = `${file}.json`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
}

async function verify(transaction) {
  const templates = await transaction.clothingRecurringPaymentTemplate.findMany({ where: { id: { startsWith: operation } }, orderBy: { id: 'asc' } });
  assert.equal(templates.length, 10);
  for (const facility of facilities) {
    const template = templates.find(row => row.id === `${operation}-${facility.key}`);
    assert.ok(template);
    assert.equal(template.kind, 'EXPENSE');
    assert.equal(template.amount, facility.amount);
    assert.equal(template.debitAccount, expenseAccount);
    assert.equal(template.creditAccount, 'Cash');
    assert.equal(template.nextDueDate.toISOString(), date(facility.next).toISOString());
    assert.equal(template.endDate.toISOString(), date(facility.end).toISOString());
    assert.equal(template.isActive, !facility.paused);
  }
  const originals = await transaction.clothingAccountingJournalLine.findMany({ where: { ref: { in: payments.map(row => row.ref) } }, orderBy: { id: 'asc' } });
  assert.equal(originals.length, 18);
  assert.ok(originals.every(row => row.deletedAt && row.sourceType === 'MANUAL'));
  const drafts = await transaction.clothingRecurringPaymentDraft.findMany({ where: { id: { startsWith: operation } }, orderBy: { id: 'asc' } });
  assert.equal(drafts.filter(row => row.status === 'APPROVED').length, 9);
  assert.equal(drafts.filter(row => row.status === 'DRAFT').length, 1);
  const lines = await transaction.clothingAccountingJournalLine.findMany({ where: { deletedAt: null, ref: { startsWith: `RECURRING:${operation}` } }, orderBy: { id: 'asc' } });
  assert.equal(lines.length, 18);
  assert.equal(money(lines.filter(row => row.account === 'Cash').map(row => row.credit - row.debit)), '72090.08');
  assert.equal(money(lines.filter(row => row.account === expenseAccount).map(row => row.debit - row.credit)), '72090.08');
  for (const payment of payments) {
    const id = `${operation}-${payment.key}-${payment.day}`;
    const draft = drafts.find(row => row.id === id);
    assert.ok(draft && draft.status === 'APPROVED');
    const pair = lines.filter(row => row.sourceId === id);
    assert.equal(pair.length, 2);
    assert.ok(pair.every(row => row.date.toISOString() === date(payment.day).toISOString() && row.sourceType === 'RECURRING_PAYMENT'));
    assert.equal(money(pair.map(row => row.debit - row.credit)), '0.00');
  }
  assert.ok(drafts.every(row => row.dueDate >= date('2026-10-12')));
  const unpaid = drafts.find(row => row.status === 'DRAFT');
  assert.equal(unpaid.dueDate.toISOString(), date('2026-10-29').toISOString());
  assert.ok(!lines.some(row => row.sourceId === unpaid.id));
  return { templates: templates.length, activeTemplates: templates.filter(row => row.isActive).length, pausedTemplates: templates.filter(row => !row.isActive).map(row => row.name), paidDrafts: 9, unpaidDrafts: 1, preservedCashOutflow: '72090.08', originalLinesSoftDeleted: originals.length };
}

async function convert(manifestPath, rehearsal) {
  const manifest = verifiedBackup(manifestPath);
  let result;
  const rollback = new Error('EXPECTED_REHEARSAL_ROLLBACK');
  try {
    await client.$transaction(async transaction => {
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('SIM-DUES-RECURRING-20261029'))");
      const before = await protect(transaction);
      const existing = await transaction.clothingRecurringPaymentTemplate.count({ where: { id: { startsWith: operation } } });
      if (existing) {
        result = { idempotentNoop: true, ...await verify(transaction) };
        return;
      }
      const originals = await transaction.clothingAccountingJournalLine.findMany({ where: { deletedAt: null, ref: { startsWith: 'SIM-DUES-' } }, orderBy: { id: 'asc' } });
      assert.equal(originals.length, 18);
      for (const payment of payments) {
        const facility = facilityByKey.get(payment.key);
        const pair = originals.filter(row => row.ref === payment.ref);
        assert.equal(pair.length, 2);
        assert.ok(pair.every(row => row.date.toISOString() === date(payment.day).toISOString() && row.sourceType === 'MANUAL' && row.sourceId === payment.sourceId));
        assert.deepEqual(pair.map(row => row.sourceLineKey).sort(), ['credit', 'debit']);
        assert.ok(pair.some(row => row.account === payment.account && row.debit === facility.amount && row.credit === 0));
        assert.ok(pair.some(row => row.account === 'Cash' && row.credit === facility.amount && row.debit === 0));
      }
      const now = new Date();
      for (const facility of facilities) {
        const notes = `[SIMULATION] ${operation}. Full installment provisionally treated as monthly fee for development cash-flow testing, NOT verified principal/interest or production policy. No pre-cutover cash replay. ${facility.reason || 'Next date follows owner-confirmed paid October installment; CSV end date.'}`;
        await transaction.clothingRecurringPaymentTemplate.create({ data: { id: `${operation}-${facility.key}`, name: `${operation} ${facility.name}`, kind: 'EXPENSE', amount: facility.amount, frequency: 'MONTHLY', dayOfMonth: facility.day, nextDueDate: date(facility.next), endDate: date(facility.end), debitAccount: expenseAccount, creditAccount: 'Cash', notes, isActive: !facility.paused } });
      }
      for (const payment of payments) {
        const facility = facilityByKey.get(payment.key);
        const id = `${operation}-${payment.key}-${payment.day}`;
        const ref = `RECURRING:${operation}:${facility.key}`;
        const description = `[SIMULATION] Replaces ${payment.ref}; owner reports installment paid. Preserves prior simulation date, not independent bank evidence. Full installment provisionally expensed; no principal/interest split. Original source retained by soft deletion.`;
        await transaction.clothingRecurringPaymentDraft.create({ data: { id, templateId: `${operation}-${facility.key}`, dueDate: date(payment.day), amount: facility.amount, debitAccount: expenseAccount, creditAccount: 'Cash', ref, description, status: 'APPROVED', approvedAt: now } });
        await transaction.clothingAccountingJournalLine.createMany({ data: [
          { date: date(payment.day), ref, account: expenseAccount, debit: facility.amount, credit: 0, description, sourceType: 'RECURRING_PAYMENT', sourceId: id, sourceLineKey: 'debit', systemGenerated: true },
          { date: date(payment.day), ref, account: 'Cash', debit: 0, credit: facility.amount, description, sourceType: 'RECURRING_PAYMENT', sourceId: id, sourceLineKey: 'credit', systemGenerated: true },
        ] });
      }
      await transaction.clothingRecurringPaymentDraft.create({ data: { id: `${operation}-esquire-2-29-2026-10-29`, templateId: `${operation}-esquire-2-29`, dueDate: date('2026-10-29'), amount: 5666.67, debitAccount: expenseAccount, creditAccount: 'Cash', ref: `RECURRING:${operation}:esquire-2-29`, description: '[SIMULATION] Due October 29; payment NOT confirmed. Do not approve automatically.', status: 'DRAFT' } });
      const removed = await transaction.clothingAccountingJournalLine.updateMany({ where: { id: { in: originals.map(row => row.id) }, deletedAt: null }, data: { deletedAt: now } });
      assert.equal(removed.count, 18);
      assert.deepEqual(await protect(transaction), before, 'Unrelated business data changed.');
      result = { operation, executedAt: now.toISOString(), ...await verify(transaction), protectedHashes: before, backup: manifest.file, originalsBeforeHash: hash(originals), originalsBefore: originals, rehearsal };
      if (rehearsal) throw rollback;
    }, { isolationLevel: 'Serializable', timeout: 120000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  if (rehearsal) {
    assert.equal(await client.clothingRecurringPaymentTemplate.count({ where: { id: { startsWith: operation } } }), 0);
    assert.equal(await client.clothingAccountingJournalLine.count({ where: { deletedAt: null, ref: { startsWith: 'SIM-DUES-' } } }), 18);
    await client.$transaction(async transaction => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      assert.deepEqual(await protect(transaction), result.protectedHashes);
      const restored = await transaction.clothingAccountingJournalLine.findMany({ where: { deletedAt: null, ref: { startsWith: 'SIM-DUES-' } }, orderBy: { id: 'asc' } });
      assert.equal(hash(restored), result.originalsBeforeHash);
    }, { isolationLevel: 'RepeatableRead' });
  }
  if (!rehearsal && !result.idempotentNoop) fs.writeFileSync(path.join(root, 'reports/clothing-dues-recurring-conversion-result-2026-10-29.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
}

async function verifyFinal(transaction) {
  const templates = await transaction.clothingRecurringPaymentTemplate.findMany({ where: { id: { startsWith: finalOperation } } });
  const drafts = await transaction.clothingRecurringPaymentDraft.findMany({ where: { id: { startsWith: finalOperation } } });
  const lines = await transaction.clothingAccountingJournalLine.findMany({ where: { ref: `RECURRING:${finalOperation}` } });
  assert.equal(templates.length, 1);
  const template = templates[0];
  assert.equal(template.isActive, false);
  assert.equal(template.kind, 'EXPENSE');
  assert.equal(template.amount, finalAmount);
  assert.equal(template.dayOfMonth, 25);
  assert.equal(template.nextDueDate.toISOString(), date(finalDate).toISOString());
  assert.equal(template.endDate.toISOString(), date(finalDate).toISOString());
  assert.equal(drafts.length, 1);
  const draft = drafts[0];
  assert.equal(draft.templateId, template.id);
  assert.equal(draft.status, 'APPROVED');
  assert.ok(draft.approvedAt);
  assert.equal(draft.dueDate.toISOString(), date(finalDate).toISOString());
  assert.equal(draft.amount, finalAmount);
  assert.equal(lines.length, 2);
  assert.ok(lines.every(row => row.deletedAt === null && row.sourceType === 'RECURRING_PAYMENT' && row.sourceId === draft.id && row.date.toISOString() === date(finalDate).toISOString()));
  assert.ok(lines.some(row => row.account === expenseAccount && row.debit === finalAmount && row.credit === 0 && row.sourceLineKey === 'debit'));
  assert.ok(lines.some(row => row.account === 'Cash' && row.debit === 0 && row.credit === finalAmount && row.sourceLineKey === 'credit'));
  return { finalPayment: finalAmount.toFixed(2), paidDate: finalDate, templateId: template.id, draftId: draft.id, journalIds: lines.map(row => row.id), inactiveAfterFinalPayment: true, futurePaymentsCreated: 0 };
}

async function addFinalPayment(manifestPath, rehearsal) {
  const manifest = verifiedBackup(manifestPath, finalOperation);
  const conversion = JSON.parse(fs.readFileSync(path.join(root, 'reports/clothing-dues-recurring-conversion-result-2026-10-29.json'), 'utf8'));
  assert.ok(new Date(manifest.createdAt) > new Date(conversion.executedAt), 'Backup must include the earlier conversion.');
  const rollback = new Error('EXPECTED_FINAL_PAYMENT_ROLLBACK');
  let result;
  try {
    await client.$transaction(async transaction => {
      await transaction.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('SIM-DUES-ESQUIRE3-FINAL-20261029'))");
      await verify(transaction);
      if (await transaction.clothingRecurringPaymentTemplate.count({ where: { id: { startsWith: finalOperation } } })) {
        result = { idempotentNoop: true, ...await verifyFinal(transaction) };
        return;
      }
      const before = await protect(transaction, finalOperation);
      const duplicates = await transaction.$queryRawUnsafe(`SELECT id FROM public.clothing_accounting_journal_lines WHERE "deletedAt" IS NULL AND (ref ~* 'esquire[[:space:]_-]*(loan[[:space:]_-]*)?3([^0-9]|$)' OR description ~* 'esquire[[:space:]_-]*(loan[[:space:]_-]*)?3([^0-9]|$)')`);
      const expenseDuplicates = await transaction.$queryRawUnsafe(`SELECT id FROM public.expenses WHERE "deletedAt" IS NULL AND description ~* 'esquire[[:space:]_-]*(loan[[:space:]_-]*)?3([^0-9]|$)'`);
      assert.equal(duplicates.length, 0, 'Review existing Esquire 3 journal evidence before posting.');
      assert.equal(expenseDuplicates.length, 0, 'Review existing Esquire 3 expense evidence before posting.');
      const cashBefore = await transaction.clothingAccountingJournalLine.findMany({ where: { account: 'Cash', deletedAt: null } });
      const now = new Date();
      const templateId = `${finalOperation}-esquire-3`;
      const draftId = `${finalOperation}-${finalDate}`;
      const ref = `RECURRING:${finalOperation}`;
      const description = '[SIMULATION] Owner confirms final Esquire 3 installment paid October 25, 2026; facility ended that day. Additional payment, not a replacement. Full amount provisionally expensed; no verified principal/interest split. No future dues.';
      await transaction.clothingRecurringPaymentTemplate.create({ data: { id: templateId, name: '[SIMULATION] Esquire 3 - completed October 25', kind: 'EXPENSE', amount: finalAmount, frequency: 'MONTHLY', dayOfMonth: 25, nextDueDate: date(finalDate), endDate: date(finalDate), debitAccount: expenseAccount, creditAccount: 'Cash', notes: description, isActive: false } });
      await transaction.clothingRecurringPaymentDraft.create({ data: { id: draftId, templateId, dueDate: date(finalDate), amount: finalAmount, debitAccount: expenseAccount, creditAccount: 'Cash', ref, description, status: 'APPROVED', approvedAt: now } });
      await transaction.clothingAccountingJournalLine.createMany({ data: [
        { date: date(finalDate), ref, account: expenseAccount, debit: finalAmount, credit: 0, description, sourceType: 'RECURRING_PAYMENT', sourceId: draftId, sourceLineKey: 'debit', systemGenerated: true },
        { date: date(finalDate), ref, account: 'Cash', debit: 0, credit: finalAmount, description, sourceType: 'RECURRING_PAYMENT', sourceId: draftId, sourceLineKey: 'credit', systemGenerated: true },
      ] });
      assert.deepEqual(await protect(transaction, finalOperation), before, 'Existing business data changed.');
      const cashAfter = await transaction.clothingAccountingJournalLine.findMany({ where: { account: 'Cash', deletedAt: null } });
      const netCash = rows => money(rows.map(row => new Decimal(row.debit).minus(row.credit)));
      assert.equal(new Decimal(netCash(cashAfter)).minus(netCash(cashBefore)).toFixed(2), '-11333.33');
      await verify(transaction);
      result = { operation: finalOperation, executedAt: now.toISOString(), ...await verifyFinal(transaction), cashChange: '-11333.33', paidDuesAfterCutover: '83423.41', protectedHashes: before, backup: manifest.file, rehearsal };
      if (rehearsal) throw rollback;
    }, { isolationLevel: 'Serializable', timeout: 120000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  if (rehearsal) {
    await client.$transaction(async transaction => {
      await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      assert.equal(await transaction.clothingRecurringPaymentTemplate.count({ where: { id: { startsWith: finalOperation } } }), 0);
      assert.equal(await transaction.clothingRecurringPaymentDraft.count({ where: { id: { startsWith: finalOperation } } }), 0);
      assert.equal(await transaction.clothingAccountingJournalLine.count({ where: { ref: `RECURRING:${finalOperation}` } }), 0);
      assert.deepEqual(await protect(transaction, finalOperation), result.protectedHashes);
      await verify(transaction);
    }, { isolationLevel: 'RepeatableRead' });
  }
  if (!rehearsal && !result.idempotentNoop) fs.writeFileSync(path.join(root, 'reports/clothing-esquire3-final-result-2026-10-29.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const mode = process.argv[2] || '--plan';
  try {
    if (mode === '--plan') {
      require('tsx/cjs');
      const { detectAccountType } = require('../../src/lib/accounting/account-classification.ts');
      assert.equal(detectAccountType(expenseAccount), null);
      assert.equal(new Decimal('72090.08').plus(finalAmount).toFixed(2), '83423.41');
      console.log(JSON.stringify({ operation, target: 'development only', paidBeforeCutoverNotReposted: { installments: 7, amount: '52796.97' }, replacementPayments: payments.length, replacementTotal: '72090.08', esquire3Addendum: { operation: finalOperation, date: finalDate, amount: finalAmount, ended: true, combinedPaidDues: '83423.41' }, templates: facilities, mode: 'preview only; no database access' }, null, 2));
    } else if (mode === '--backup') await backup();
    else if (mode === '--backup-esquire3') await backup(finalOperation);
    else if (mode === '--rehearse-esquire3' || mode === '--apply-esquire3') await addFinalPayment(process.argv[3], mode === '--rehearse-esquire3');
    else if (mode === '--verify-esquire3') {
      const result = await client.$transaction(async transaction => { await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY'); await verify(transaction); return verifyFinal(transaction); }, { isolationLevel: 'RepeatableRead' });
      console.log(JSON.stringify(result, null, 2));
    }
    else if (mode === '--rehearse' || mode === '--apply') await convert(process.argv[3], mode === '--rehearse');
    else if (mode === '--verify') {
      const result = await client.$transaction(async transaction => { await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY'); return verify(transaction); }, { isolationLevel: 'RepeatableRead' });
      console.log(JSON.stringify(result, null, 2));
    } else throw new Error('Unsupported mode.');
  } finally { await client.$disconnect(); }
}

main().catch(error => { console.error(error.name, error.code || '', error.message); process.exitCode = 1; });
