import type {
  ClothingRecurringPaymentDraft,
  ClothingRecurringPaymentTemplate,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  addOneMonthUtc,
  isMissingTableError,
  normalizeUtcMidnight,
  resolveTaggedAccount,
} from '@/modules/shared/ledger/recurring-payments/api/helpers';
import type {
  ClothingRecurringPaymentApproveInput,
  ClothingRecurringPaymentDraftListInput,
  ClothingRecurringPaymentGenerateInput,
  ClothingRecurringPaymentSkipInput,
  ClothingRecurringPaymentTemplateCreateInput,
  ClothingRecurringPaymentTemplateDeleteInput,
  ClothingRecurringPaymentTemplateUpdateInput,
} from './schemas';

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
    const cutover = await getRuntimeAccountingCutoverDate('clothing');

    if (nextDueDate < cutover) {
      throw new Error(
        `nextDueDate must be on or after ${cutover.toISOString().slice(0, 10)}`
      );
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
    const cutover = await getRuntimeAccountingCutoverDate('clothing');

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.ClothingRecurringPaymentTemplateUncheckedUpdateInput =
        {
          ...rest,
        };

      if (nextDueDate) {
        const normalized = normalizeUtcMidnight(nextDueDate);
        if (normalized < cutover) {
          throw new Error(
            `nextDueDate must be on or after ${cutover.toISOString().slice(0, 10)}`
          );
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
    const cutover = await getRuntimeAccountingCutoverDate('clothing');

    if (upToDate < cutover) {
      throw new Error(
        `upToDate must be on or after ${cutover.toISOString().slice(0, 10)}`
      );
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

          const inserted = await tx.clothingRecurringPaymentDraft.createMany({
            data: [
              {
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
            ],
            skipDuplicates: true,
          });
          created += inserted.count;
          skipped += 1 - inserted.count;

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
    const cutover = await getRuntimeAccountingCutoverDate('clothing');

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
        if (entryDate < cutover) {
          throw new Error(
            `Draft dueDate must be on or after ${cutover.toISOString().slice(0, 10)}`
          );
        }

        const sourceId = draft.id;

        // Prevent double-posting if something weird happens.
        // Filter out soft-deleted lines (column added 2026-04-19) so re-posting
        // after a soft delete is allowed.
        const existingLines = await tx.clothingAccountingJournalLine.findMany({
          where: {
            deletedAt: null,
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

        const approved = await tx.clothingRecurringPaymentDraft.updateMany({
          where: { id: draft.id, status: 'DRAFT' },
          data: {
            status: 'APPROVED',
            approvedAt: now,
          },
        });

        if (approved.count !== 1) {
          throw new Error('Draft is already processed');
        }

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

      const skipped = await tx.clothingRecurringPaymentDraft.updateMany({
        where: { id: draft.id, status: 'DRAFT' },
        data: {
          status: 'SKIPPED',
          approvedAt: null,
        },
      });

      if (skipped.count !== 1) {
        throw new Error('Draft is already processed');
      }

      return { draftId: draft.id };
    });
  }
}

export const clothingRecurringPaymentService =
  new ClothingRecurringPaymentService();
