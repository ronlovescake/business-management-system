import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClothingRecurringPaymentService } from '../service';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  clothingRecurringPaymentTemplate: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  clothingRecurringPaymentDraft: {
    create: vi.fn(),
    createMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  clothingAccountingJournalLine: { findMany: vi.fn(), create: vi.fn() },
}));
const runtimeCutover = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/accounting/cutover', () => ({
  getAccountingCutoverDate: () => new Date('2026-01-17T00:00:00Z'),
  getRuntimeAccountingCutoverDate: runtimeCutover,
}));

const service = new ClothingRecurringPaymentService();
const template = {
  id: 'template-1',
  name: 'Rent',
  kind: 'EXPENSE' as const,
  amount: 100,
  frequency: 'MONTHLY' as const,
  dayOfMonth: 20,
  nextDueDate: new Date('2026-01-20T00:00:00Z'),
  endDate: null,
  debitAccount: 'Rent Expense',
  creditAccount: 'Cash on Hand',
  debitTag: null,
  creditTag: null,
  notes: null,
  isActive: true,
};
const draft = {
  id: 'draft-1',
  templateId: template.id,
  template,
  status: 'DRAFT',
  dueDate: template.nextDueDate,
  amount: 100,
  debitAccount: template.debitAccount,
  creditAccount: template.creditAccount,
  debitTag: null,
  creditTag: null,
  ref: 'RECURRING:Rent',
  description: null,
};

describe('clothing recurring payment integrity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runtimeCutover.mockResolvedValue(new Date('2026-02-01T00:00:00Z'));
    db.$transaction.mockImplementation(
      (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
    );
    db.clothingRecurringPaymentTemplate.create.mockResolvedValue(template);
    db.clothingRecurringPaymentTemplate.update.mockResolvedValue(template);
    db.clothingRecurringPaymentTemplate.findMany.mockResolvedValue([]);
    db.clothingRecurringPaymentDraft.findUnique.mockResolvedValue(draft);
    db.clothingRecurringPaymentDraft.createMany.mockResolvedValue({ count: 1 });
    db.clothingAccountingJournalLine.findMany.mockResolvedValue([]);
  });

  it('rejects template creation before the saved runtime cutover', async () => {
    await expect(service.createTemplate(template)).rejects.toThrow(
      '2026-02-01'
    );
    expect(db.clothingRecurringPaymentTemplate.create).not.toHaveBeenCalled();
  });

  it('rejects date edits before the saved runtime cutover', async () => {
    await expect(
      service.updateTemplate(template.id, {
        id: template.id,
        nextDueDate: template.nextDueDate,
      })
    ).rejects.toThrow('2026-02-01');
    expect(db.clothingRecurringPaymentTemplate.update).not.toHaveBeenCalled();
  });

  it('rejects generation before the saved runtime cutover', async () => {
    await expect(
      service.generateDueDrafts({ upToDate: template.nextDueDate })
    ).rejects.toThrow('2026-02-01');
    expect(db.clothingRecurringPaymentTemplate.findMany).not.toHaveBeenCalled();
  });

  it('rejects approval before the saved runtime cutover without writing a journal', async () => {
    await expect(service.approveDraft({ draftId: draft.id })).rejects.toThrow(
      '2026-02-01'
    );
    expect(db.clothingAccountingJournalLine.create).not.toHaveBeenCalled();
    expect(db.clothingRecurringPaymentDraft.update).not.toHaveBeenCalled();
  });

  it('reads changed saved cutovers on subsequent requests', async () => {
    await service.createTemplate({
      ...template,
      nextDueDate: new Date('2026-02-20T00:00:00Z'),
    });
    runtimeCutover.mockResolvedValue(new Date('2026-03-01T00:00:00Z'));
    await expect(
      service.createTemplate({
        ...template,
        nextDueDate: new Date('2026-02-20T00:00:00Z'),
      })
    ).rejects.toThrow('2026-03-01');
    expect(runtimeCutover).toHaveBeenLastCalledWith('clothing');
  });

  it('skips an existing due draft without raising a transaction-aborting unique violation', async () => {
    db.clothingRecurringPaymentTemplate.findMany.mockResolvedValue([
      { ...template, nextDueDate: new Date('2026-02-20T00:00:00Z') },
    ]);
    db.clothingRecurringPaymentDraft.create.mockRejectedValue({
      code: 'P2002',
    });
    db.clothingRecurringPaymentDraft.createMany.mockResolvedValue({ count: 0 });
    const result = await service.generateDueDrafts({
      upToDate: new Date('2026-02-20T00:00:00Z'),
    });
    expect(result).toMatchObject({ created: 0, skipped: 1 });
    expect(db.clothingRecurringPaymentDraft.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          templateId: template.id,
          dueDate: new Date('2026-02-20T00:00:00Z'),
        }),
      ],
      skipDuplicates: true,
    });
    expect(db.clothingRecurringPaymentDraft.create).not.toHaveBeenCalled();
    expect(db.clothingRecurringPaymentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextDueDate: new Date('2026-03-20T00:00:00Z'),
        }),
      })
    );
  });

  it('creates month-end drafts once per month without losing the configured day', async () => {
    db.clothingRecurringPaymentTemplate.findMany.mockResolvedValue([
      {
        ...template,
        dayOfMonth: 31,
        nextDueDate: new Date('2026-02-28T00:00:00Z'),
      },
    ]);
    const result = await service.generateDueDrafts({
      upToDate: new Date('2026-03-31T00:00:00Z'),
    });
    expect(result.created).toBe(2);
    expect(
      db.clothingRecurringPaymentDraft.createMany.mock.calls.map(
        ([input]) => input.data[0].dueDate
      )
    ).toEqual([
      new Date('2026-02-28T00:00:00Z'),
      new Date('2026-03-31T00:00:00Z'),
    ]);
    expect(db.clothingRecurringPaymentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextDueDate: new Date('2026-04-30T00:00:00Z'),
        }),
      })
    );
  });
});
