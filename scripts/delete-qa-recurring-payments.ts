import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const QA_REFS = [
  'RECURRING:QA Recurring Payment 20260116-1768560412906',
  'RECURRING:QA Recurring Payment 20260116-1768560508017',
  'RECURRING:QA Recurring Payment 20260116-1768560545004',
  'RECURRING:QA Recurring Payment 20260116-1768561865286',
] as const;

function parseArgs(argv: string[]): { execute: boolean } {
  const execute = argv.includes('--execute');
  return { execute };
}

async function main() {
  const { execute } = parseArgs(process.argv.slice(2));

  const names = QA_REFS.map((ref) => ref.replace(/^RECURRING:/, ''));

  const [templates, drafts, journalLines] = await Promise.all([
    prisma.clothingRecurringPaymentTemplate.findMany({
      where: { name: { in: names } },
      select: {
        id: true,
        name: true,
        isActive: true,
        nextDueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.clothingRecurringPaymentDraft.findMany({
      where: { ref: { in: [...QA_REFS] } },
      select: {
        id: true,
        templateId: true,
        dueDate: true,
        status: true,
        ref: true,
        amount: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.clothingAccountingJournalLine.findMany({
      where: { ref: { in: [...QA_REFS] } },
      select: {
        id: true,
        date: true,
        ref: true,
        account: true,
        debit: true,
        credit: true,
        sourceType: true,
        sourceId: true,
        sourceLineKey: true,
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    }),
  ]);

  // eslint-disable-next-line no-console
  console.log('QA recurring payment cleanup');
  // eslint-disable-next-line no-console
  console.log('============================');
  // eslint-disable-next-line no-console
  console.log('Refs:', QA_REFS);
  // eslint-disable-next-line no-console
  console.log('');

  // eslint-disable-next-line no-console
  console.log(`Found templates: ${templates.length}`);
  for (const t of templates) {
    // eslint-disable-next-line no-console
    console.log(
      `- template ${t.id} | ${t.name} | active=${t.isActive} | nextDue=${t.nextDueDate.toISOString().slice(0, 10)}`
    );
  }

  // eslint-disable-next-line no-console
  console.log(`\nFound drafts: ${drafts.length}`);
  for (const d of drafts) {
    // eslint-disable-next-line no-console
    console.log(
      `- draft ${d.id} | template=${d.templateId} | ${d.status} | due=${d.dueDate.toISOString().slice(0, 10)} | amt=${d.amount} | ${d.ref}`
    );
  }

  // eslint-disable-next-line no-console
  console.log(`\nFound journal lines: ${journalLines.length}`);
  for (const l of journalLines) {
    // eslint-disable-next-line no-console
    console.log(
      `- line ${l.id} | ${l.date.toISOString().slice(0, 10)} | ${l.account} | dr=${l.debit} cr=${l.credit} | ${l.sourceType}:${l.sourceId ?? ''}:${l.sourceLineKey}`
    );
  }

  if (!execute) {
    // eslint-disable-next-line no-console
    console.log('\nDry run only. Re-run with --execute to delete.');
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedJournal = await tx.clothingAccountingJournalLine.deleteMany({
      where: { ref: { in: [...QA_REFS] } },
    });

    // Delete templates (cascades drafts). Also delete any remaining drafts by ref just in case.
    const deletedTemplates =
      await tx.clothingRecurringPaymentTemplate.deleteMany({
        where: { name: { in: names } },
      });

    const deletedDrafts = await tx.clothingRecurringPaymentDraft.deleteMany({
      where: { ref: { in: [...QA_REFS] } },
    });

    return { deletedJournal, deletedTemplates, deletedDrafts };
  });

  logger.info('Deleted QA recurring payment rows', result);

  // eslint-disable-next-line no-console
  console.log('\nDeleted:');
  // eslint-disable-next-line no-console
  console.log({
    journalLines: result.deletedJournal.count,
    templates: result.deletedTemplates.count,
    drafts: result.deletedDrafts.count,
  });
}

main()
  .catch((error) => {
    logger.error('delete-qa-recurring-payments failed', { error });
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
