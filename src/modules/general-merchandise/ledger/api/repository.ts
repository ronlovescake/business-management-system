import type { PrismaModelName } from '@/types/prisma';
import { ExpenseRepositoryBase } from '@/modules/shared/ledger/expenses/api/repositoryBase';
import type {
  GeneralMerchandiseExpenseCreateDbInput,
  GeneralMerchandiseExpenseUpdateDbInput,
} from './schemas';

export type GeneralMerchandiseExpenseEntity = {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes?: string | null;
  receipt?: string | null;
  status: string;
  employeeName?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean | null;
  paymentMethod?: string | null;
  paymentCardId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export class GeneralMerchandiseExpenseRepository extends ExpenseRepositoryBase<
  GeneralMerchandiseExpenseEntity,
  GeneralMerchandiseExpenseCreateDbInput,
  GeneralMerchandiseExpenseUpdateDbInput
> {
  constructor() {
    super('generalMerchandiseExpense' as PrismaModelName);
  }
}

export const generalMerchandiseExpenseRepository =
  new GeneralMerchandiseExpenseRepository();
