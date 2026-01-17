import type {
  ClothingRecurringPaymentDraft,
  ClothingRecurringPaymentTemplate,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildTaggedAccountName,
  isTaggableAccountParent,
} from '@/lib/accounting/account-tagging';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import type {
  ClothingRecurringPaymentApproveInput,
  ClothingRecurringPaymentDraftListInput,
  ClothingRecurringPaymentGenerateInput,
  ClothingRecurringPaymentSkipInput,
  ClothingRecurringPaymentTemplateCreateInput,
  ClothingRecurringPaymentTemplateDeleteInput,
  ClothingRecurringPaymentTemplateUpdateInput,
} from './schemas';

const CUTOVER = getAccountingCutoverDate();
const CUTOVER_LABEL = CUTOVER.toISOString().slice(0, 10);

const normalizeUtcMidnight = (date: Date): Date => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

const clampDayInMonthUtc = (year: number, monthIndex: number, day: number) => {
  // monthIndex: 0-11
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
};

const addOneMonthUtc = (date: Date, dayOfMonth: number): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  const nextMonthIndex = month + 1;
  const nextYear = year + Math.floor(nextMonthIndex / 12);
  const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;

  const day = clampDayInMonthUtc(nextYear, normalizedMonth, dayOfMonth);
  return new Date(Date.UTC(nextYear, normalizedMonth, day));
};

const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  return code === 'P2002';
};

const isMissingTableError = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return code === 'P2021' || message.includes('does not exist');
};

const resolveTaggedAccount = (account: string, tag: string | null): string => {
  if (!tag) {
    return account;
  }

  if (!isTaggableAccountParent(account)) {
    return account;
  }

  return buildTaggedAccountName(account, tag);
};

export class ClothingRecurringPaymentService {
  async findTemplates(): Promise<ClothingRecurringPaymentTemplate[]> {
    return prisma.clothingRecurringPaymentTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(
    data: ClothingRecurringPaymentTemplateCreateInput
  ): Promise<ClothingRecurringPaymentTemplate> {
    const nextDueDate = normalizeUtcMidnight(data.nextDueDate);
    const endDate = data.endDate ? normalizeUtcMidnight(data.endDate) : null;

    if (nextDueDate < CUTOVER) {
      throw new Error(`nextDueDate must be on or after ${CUTOVER_LABEL}`);
    }

    if (endDate && endDate < nextDueDate) {
      throw new Error('endDate must be on or after nextDueDate');
    }

    return prisma.clothingRecurringPaymentTemplate.create({
      data: {
        name: data.name,
        kind: data.kind,
        amount: data.amount,
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth,
        nextDueDate,
        endDate,
        debitAccount: data.debitAccount,
        debitTag: data.debitTag ?? null,
        creditAccount: data.creditAccount,
        creditTag: data.creditTag ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateTemplate(
    id: string,
    data: ClothingRecurringPaymentTemplateUpdateInput
  ): Promise<ClothingRecurringPaymentTemplate> {
    const { id: _, nextDueDate, endDate, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.ClothingRecurringPaymentTemplateUncheckedUpdateInput =
        {
          ...rest,
        };

      if (nextDueDate) {
        const normalized = normalizeUtcMidnight(nextDueDate);
        if (normalized < CUTOVER) {
          throw new Error(`nextDueDate must be on or after ${CUTOVER_LABEL}`);
        }
        updateData.nextDueDate = normalized;
      }

      if (endDate !== undefined) {
        updateData.endDate = endDate ? normalizeUtcMidnight(endDate) : null;
      }

      const updated = await tx.clothingRecurringPaymentTemplate.update({
        where: { id },
        data: updateData,
      });

      if (updated.endDate && updated.endDate < updated.nextDueDate) {
        throw new Error('endDate must be on or after nextDueDate');
      }

      return updated;
    });
  }

  async deleteTemplate(
    data: ClothingRecurringPaymentTemplateDeleteInput
  ): Promise<ClothingRecurringPaymentTemplate> {
    return prisma.clothingRecurringPaymentTemplate.delete({
      where: { id: data.id },
    });
  }

  async listDrafts(input: ClothingRecurringPaymentDraftListInput): Promise<
    (ClothingRecurringPaymentDraft & {
      template: ClothingRecurringPaymentTemplate;
    })[]
  > {
    const where: Prisma.ClothingRecurringPaymentDraftWhereInput = {};

    if (input.status) {
      where.status = input.status;
    }

    const dueDateFilter: Prisma.DateTimeFilter = {};

    if (input.dueFrom) {
      dueDateFilter.gte = normalizeUtcMidnight(input.dueFrom);
    }

    if (input.dueTo) {
      // inclusive
      const to = normalizeUtcMidnight(input.dueTo);
      dueDateFilter.lte = new Date(
        Date.UTC(
          to.getUTCFullYear(),
          to.getUTCMonth(),
          to.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );
    }

    if (input.dueOnOrBefore) {
      const to = normalizeUtcMidnight(input.dueOnOrBefore);
      dueDateFilter.lte = new Date(
        Date.UTC(
          to.getUTCFullYear(),
          to.getUTCMonth(),
          to.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );
    }

    if (Object.keys(dueDateFilter).length > 0) {
      where.dueDate = dueDateFilter;
    }

    return prisma.clothingRecurringPaymentDraft.findMany({
      where,
      include: { template: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async generateDueDrafts(
    input?: ClothingRecurringPaymentGenerateInput
  ): Promise<{ created: number; skipped: number; upToDate: string }> {
    const rawUpTo = input?.upToDate ?? new Date();
    const upToDate = normalizeUtcMidnight(rawUpTo);

    if (upToDate < CUTOVER) {
      throw new Error(`upToDate must be on or after ${CUTOVER_LABEL}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const templates = await tx.clothingRecurringPaymentTemplate.findMany({
        where: {
          isActive: true,
          nextDueDate: { lte: upToDate },
        },
        orderBy: { createdAt: 'asc' },
      });

      let created = 0;
      let skipped = 0;

      for (const template of templates) {
        const endDate = template.endDate
          ? normalizeUtcMidnight(template.endDate)
          : null;

        let nextDue = normalizeUtcMidnight(template.nextDueDate);

        if (endDate && nextDue > endDate) {
          await tx.clothingRecurringPaymentTemplate.update({
            where: { id: template.id },
            data: { isActive: false },
            select: { id: true },
          });
          skipped++;
          continue;
        }

        while (nextDue <= upToDate && (!endDate || nextDue <= endDate)) {
          const ref = `RECURRING:${template.name}`.slice(0, 120);
          const description = template.notes ?? null;

          try {
            await tx.clothingRecurringPaymentDraft.create({
              data: {
                templateId: template.id,
                dueDate: nextDue,
                amount: template.amount,
                debitAccount: template.debitAccount,
                debitTag: template.debitTag,
                creditAccount: template.creditAccount,
                creditTag: template.creditTag,
                ref,
                description,
                status: 'DRAFT',
                approvedAt: null,
              },
              select: { id: true },
            });

            created++;
          } catch (error) {
            if (isUniqueViolation(error)) {
              skipped++;
            } else {
              throw error;
            }
          }

          nextDue = addOneMonthUtc(nextDue, template.dayOfMonth);
        }

        await tx.clothingRecurringPaymentTemplate.update({
          where: { id: template.id },
          data: {
            nextDueDate: nextDue,
            isActive: endDate && nextDue > endDate ? false : template.isActive,
          },
          select: { id: true },
        });
      }

      return { created, skipped, templates: templates.length };
    });

    logger.info('Generated clothing recurring payment drafts', {
      upToDate: upToDate.toISOString(),
      ...result,
    });

    return {
      created: result.created,
      skipped: result.skipped,
      upToDate: upToDate.toISOString(),
    };
  }

  async approveDraft(
    input: ClothingRecurringPaymentApproveInput
  ): Promise<{ draftId: string; journalSourceId: string }> {
    const now = new Date();

    try {
      return await prisma.$transaction(async (tx) => {
        const draft = await tx.clothingRecurringPaymentDraft.findUnique({
          where: { id: input.draftId },
          include: { template: true },
        });

        if (!draft) {
          throw new Error('Draft not found');
        }

        if (draft.status !== 'DRAFT') {
          throw new Error(`Draft is already ${draft.status}`);
        }

        const entryDate = normalizeUtcMidnight(draft.dueDate);
        if (entryDate < CUTOVER) {
          throw new Error(`Draft dueDate must be on or after ${CUTOVER_LABEL}`);
        }

        const sourceId = draft.id;

        // Prevent double-posting if something weird happens
        const existingLines = await tx.clothingAccountingJournalLine.findMany({
          where: {
            sourceType: 'RECURRING_PAYMENT',
            sourceId,
            sourceLineKey: { in: ['debit', 'credit'] },
          },
          select: { id: true },
        });

        if (existingLines.length > 0) {
          throw new Error('This draft has already been posted to the ledger');
        }

        const debitAccount = resolveTaggedAccount(
          draft.debitAccount,
          draft.debitTag
        );
        const creditAccount = resolveTaggedAccount(
          draft.creditAccount,
          draft.creditTag
        );

        await tx.clothingAccountingJournalLine.create({
          data: {
            date: entryDate,
            ref: draft.ref,
            account: debitAccount,
            debit: draft.amount,
            credit: 0,
            description: draft.description,
            sourceType: 'RECURRING_PAYMENT',
            sourceId,
            sourceLineKey: 'debit',
            systemGenerated: true,
          },
          select: { id: true },
        });

        await tx.clothingAccountingJournalLine.create({
          data: {
            date: entryDate,
            ref: draft.ref,
            account: creditAccount,
            debit: 0,
            credit: draft.amount,
            description: draft.description,
            sourceType: 'RECURRING_PAYMENT',
            sourceId,
            sourceLineKey: 'credit',
            systemGenerated: true,
          },
          select: { id: true },
        });

        await tx.clothingRecurringPaymentDraft.update({
          where: { id: draft.id },
          data: {
            status: 'APPROVED',
            approvedAt: now,
          },
          select: { id: true },
        });

        return { draftId: draft.id, journalSourceId: sourceId };
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        throw new Error(
          'Recurring payments are not enabled in this database yet (missing required tables).'
        );
      }
      throw error;
    }
  }

  async skipDraft(
    input: ClothingRecurringPaymentSkipInput
  ): Promise<{ draftId: string }> {
    return prisma.$transaction(async (tx) => {
      const draft = await tx.clothingRecurringPaymentDraft.findUnique({
        where: { id: input.draftId },
        select: { id: true, status: true },
      });

      if (!draft) {
        throw new Error('Draft not found');
      }

      if (draft.status !== 'DRAFT') {
        throw new Error(`Draft is already ${draft.status}`);
      }

      await tx.clothingRecurringPaymentDraft.update({
        where: { id: draft.id },
        data: {
          status: 'SKIPPED',
          approvedAt: null,
        },
        select: { id: true },
      });

      return { draftId: draft.id };
    });
  }
}

export const clothingRecurringPaymentService =
  new ClothingRecurringPaymentService();
