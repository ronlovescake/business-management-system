import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  addOneMonthUtc,
  isMissingTableError,
  isUniqueViolation,
  normalizeUtcMidnight,
  resolveTaggedAccount,
} from '@/modules/shared/ledger/recurring-payments/api/helpers';
import type {
  GeneralMerchandiseRecurringPaymentApproveInput,
  GeneralMerchandiseRecurringPaymentDraftListInput,
  GeneralMerchandiseRecurringPaymentGenerateInput,
  GeneralMerchandiseRecurringPaymentSkipInput,
  GeneralMerchandiseRecurringPaymentTemplateCreateInput,
  GeneralMerchandiseRecurringPaymentTemplateDeleteInput,
  GeneralMerchandiseRecurringPaymentTemplateUpdateInput,
} from './schemas';

const CUTOVER = getAccountingCutoverDate();
const CUTOVER_LABEL = CUTOVER.toISOString().slice(0, 10);

type GeneralMerchandiseRecurringPaymentTemplate = {
  id: string;
  name: string;
  kind: string;
  amount: number;
  frequency: string;
  dayOfMonth: number;
  nextDueDate: Date;
  endDate: Date | null;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type GeneralMerchandiseRecurringPaymentDraft = {
  id: string;
  templateId: string;
  dueDate: Date;
  amount: number;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  ref: string;
  description: string | null;
  status: string;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const getTemplateModel = (client: unknown) =>
  (
    client as {
      generalMerchandiseRecurringPaymentTemplate?: {
        findMany?: (args: unknown) => Promise<unknown>;
        create?: (args: unknown) => Promise<unknown>;
        update?: (args: unknown) => Promise<unknown>;
        delete?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseRecurringPaymentTemplate;

const getDraftModel = (client: unknown) =>
  (
    client as {
      generalMerchandiseRecurringPaymentDraft?: {
        findMany?: (args: unknown) => Promise<unknown>;
        findUnique?: (args: unknown) => Promise<unknown>;
        create?: (args: unknown) => Promise<unknown>;
        update?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseRecurringPaymentDraft;

const getJournalModel = (client: unknown) =>
  (
    client as {
      generalMerchandiseAccountingJournalLine?: {
        createMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).generalMerchandiseAccountingJournalLine;

const requireModel = <T>(model: T | undefined, label: string): T => {
  if (!model) {
    throw new Error(`Missing GM recurring payment model: ${label}`);
  }
  return model;
};

export class GeneralMerchandiseRecurringPaymentService {
  async findTemplates(): Promise<GeneralMerchandiseRecurringPaymentTemplate[]> {
    const model = getTemplateModel(prisma);
    if (!model?.findMany) {
      logger.warn('GM recurring payment templates unavailable');
      return [];
    }

    return (await model.findMany({
      orderBy: { createdAt: 'desc' },
    })) as GeneralMerchandiseRecurringPaymentTemplate[];
  }

  async createTemplate(
    data: GeneralMerchandiseRecurringPaymentTemplateCreateInput
  ): Promise<GeneralMerchandiseRecurringPaymentTemplate> {
    const nextDueDate = normalizeUtcMidnight(data.nextDueDate);
    const endDate = data.endDate ? normalizeUtcMidnight(data.endDate) : null;

    if (nextDueDate < CUTOVER) {
      throw new Error(`nextDueDate must be on or after ${CUTOVER_LABEL}`);
    }

    if (endDate && endDate < nextDueDate) {
      throw new Error('endDate must be on or after nextDueDate');
    }

    const model = requireModel(getTemplateModel(prisma), 'template');
    if (!model.create) {
      throw new Error('GM recurring payment templates are unavailable');
    }

    return (await model.create({
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
    })) as GeneralMerchandiseRecurringPaymentTemplate;
  }

  async updateTemplate(
    id: string,
    data: GeneralMerchandiseRecurringPaymentTemplateUpdateInput
  ): Promise<GeneralMerchandiseRecurringPaymentTemplate> {
    const { id: _, nextDueDate, endDate, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      const model = requireModel(getTemplateModel(tx), 'template');
      if (!model.update) {
        throw new Error('GM recurring payment templates are unavailable');
      }

      const updateData: Record<string, unknown> = { ...rest };

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

      const updated = (await model.update({
        where: { id },
        data: updateData,
      })) as GeneralMerchandiseRecurringPaymentTemplate;

      if (updated.endDate && updated.endDate < updated.nextDueDate) {
        throw new Error('endDate must be on or after nextDueDate');
      }

      return updated;
    });
  }

  async deleteTemplate(
    data: GeneralMerchandiseRecurringPaymentTemplateDeleteInput
  ): Promise<GeneralMerchandiseRecurringPaymentTemplate> {
    const model = requireModel(getTemplateModel(prisma), 'template');
    if (!model.delete) {
      throw new Error('GM recurring payment templates are unavailable');
    }

    return (await model.delete({
      where: { id: data.id },
    })) as GeneralMerchandiseRecurringPaymentTemplate;
  }

  async listDrafts(
    input: GeneralMerchandiseRecurringPaymentDraftListInput
  ): Promise<
    (GeneralMerchandiseRecurringPaymentDraft & {
      template: GeneralMerchandiseRecurringPaymentTemplate;
    })[]
  > {
    const model = getDraftModel(prisma);
    if (!model?.findMany) {
      logger.warn('GM recurring payment drafts unavailable');
      return [];
    }

    const where: Record<string, unknown> = {};

    if (input.status) {
      where.status = input.status;
    }

    const dueDateFilter: { gte?: Date; lte?: Date } = {};

    if (input.dueFrom) {
      dueDateFilter.gte = normalizeUtcMidnight(input.dueFrom);
    }

    if (input.dueTo) {
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

    return (await model.findMany({
      where,
      include: { template: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })) as (GeneralMerchandiseRecurringPaymentDraft & {
      template: GeneralMerchandiseRecurringPaymentTemplate;
    })[];
  }

  async generateDueDrafts(
    input?: GeneralMerchandiseRecurringPaymentGenerateInput
  ): Promise<{ created: number; skipped: number; upToDate: string }> {
    const rawUpTo = input?.upToDate ?? new Date();
    const upToDate = normalizeUtcMidnight(rawUpTo);

    if (upToDate < CUTOVER) {
      throw new Error(`upToDate must be on or after ${CUTOVER_LABEL}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const templateModel = requireModel(getTemplateModel(tx), 'template');
      const draftModel = requireModel(getDraftModel(tx), 'draft');

      if (!templateModel.findMany || !templateModel.update) {
        throw new Error('GM recurring payment templates are unavailable');
      }
      if (!draftModel.create) {
        throw new Error('GM recurring payment drafts are unavailable');
      }

      const templates = (await templateModel.findMany({
        where: {
          isActive: true,
          nextDueDate: { lte: upToDate },
        },
        orderBy: { createdAt: 'asc' },
      })) as GeneralMerchandiseRecurringPaymentTemplate[];

      let created = 0;
      let skipped = 0;

      for (const template of templates) {
        const endDate = template.endDate
          ? normalizeUtcMidnight(template.endDate)
          : null;

        let nextDue = normalizeUtcMidnight(template.nextDueDate);

        if (endDate && nextDue > endDate) {
          await templateModel.update({
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
            await draftModel.create({
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
              },
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

        await templateModel.update({
          where: { id: template.id },
          data: { nextDueDate: nextDue },
          select: { id: true },
        });
      }

      return {
        created,
        skipped,
        upToDate: upToDate.toISOString().slice(0, 10),
      };
    });

    return result;
  }

  async approveDraft(
    input: GeneralMerchandiseRecurringPaymentApproveInput
  ): Promise<{ draftId: string; journalSourceId: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const draftModel = requireModel(getDraftModel(tx), 'draft');
        const templateModel = requireModel(getTemplateModel(tx), 'template');
        const journalModel = requireModel(getJournalModel(tx), 'journal');

        if (!draftModel.findUnique || !draftModel.update) {
          throw new Error('GM recurring payment drafts are unavailable');
        }
        if (!templateModel) {
          throw new Error('GM recurring payment templates are unavailable');
        }
        if (!journalModel?.createMany) {
          throw new Error('GM journal model is unavailable');
        }

        const draft = (await draftModel.findUnique({
          where: { id: input.draftId },
          include: { template: true },
        })) as
          | (GeneralMerchandiseRecurringPaymentDraft & {
              template: GeneralMerchandiseRecurringPaymentTemplate;
            })
          | null;

        if (!draft) {
          throw new Error('Recurring draft not found');
        }

        if (draft.status !== 'DRAFT') {
          return { draftId: draft.id, journalSourceId: '' };
        }

        const debitAccount = resolveTaggedAccount(
          draft.debitAccount,
          draft.debitTag
        );
        const creditAccount = resolveTaggedAccount(
          draft.creditAccount,
          draft.creditTag
        );

        const journalSourceId =
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const journalDate = normalizeUtcMidnight(draft.dueDate);
        const description = draft.description ?? draft.template.name;

        await journalModel.createMany({
          data: [
            {
              date: journalDate,
              ref: draft.ref,
              account: debitAccount,
              debit: draft.amount,
              credit: 0,
              description,
              sourceType: 'RECURRING',
              sourceId: journalSourceId,
              sourceLineKey: 'debit',
              systemGenerated: true,
            },
            {
              date: journalDate,
              ref: draft.ref,
              account: creditAccount,
              debit: 0,
              credit: draft.amount,
              description,
              sourceType: 'RECURRING',
              sourceId: journalSourceId,
              sourceLineKey: 'credit',
              systemGenerated: true,
            },
          ],
        });

        await draftModel.update({
          where: { id: draft.id },
          data: { status: 'APPROVED', approvedAt: new Date() },
          select: { id: true },
        });

        return { draftId: draft.id, journalSourceId };
      });

      return result;
    } catch (error) {
      if (isMissingTableError(error)) {
        logger.warn('Recurring payment tables missing', { error });
      }
      throw error;
    }
  }

  async skipDraft(
    input: GeneralMerchandiseRecurringPaymentSkipInput
  ): Promise<{ draftId: string }> {
    const model = requireModel(getDraftModel(prisma), 'draft');
    if (!model.update) {
      throw new Error('GM recurring payment drafts are unavailable');
    }

    await model.update({
      where: { id: input.draftId },
      data: { status: 'SKIPPED' },
      select: { id: true },
    });

    return { draftId: input.draftId };
  }
}

export const generalMerchandiseRecurringPaymentService =
  new GeneralMerchandiseRecurringPaymentService();
