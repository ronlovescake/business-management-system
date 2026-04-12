import { BaseService } from './BaseService';

export interface RecurringPaymentTemplateDTO {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  kind: 'LOAN' | 'EXPENSE';
  amount: number;
  frequency: 'MONTHLY';
  dayOfMonth: number;
  nextDueDate: string;
  endDate: string | null;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface RecurringPaymentDraftDTO<
  TTemplate extends RecurringPaymentTemplateDTO = RecurringPaymentTemplateDTO,
> {
  id: string;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  dueDate: string;
  amount: number;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  ref: string;
  description: string | null;
  status: 'DRAFT' | 'APPROVED' | 'SKIPPED';
  approvedAt: string | null;
  template: TTemplate;
}

export interface RecurringPaymentTemplateCreatePayload {
  name: string;
  kind: 'LOAN' | 'EXPENSE';
  amount: number;
  frequency?: 'MONTHLY';
  dayOfMonth: number;
  nextDueDate: string;
  endDate?: string | null;
  debitAccount: string;
  debitTag?: string | null;
  creditAccount: string;
  creditTag?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export type RecurringPaymentTemplateUpdatePayload = Partial<{
  name: string;
  kind: 'LOAN' | 'EXPENSE';
  amount: number;
  frequency: 'MONTHLY';
  dayOfMonth: number;
  nextDueDate: string;
  endDate: string | null;
  debitAccount: string;
  debitTag: string | null;
  creditAccount: string;
  creditTag: string | null;
  notes: string | null;
  isActive: boolean;
}>;

export interface RecurringPaymentGeneratePayload {
  upToDate?: string;
}

export interface RecurringPaymentGenerateResult {
  created: number;
  skipped: number;
  upToDate: string;
}

export interface RecurringPaymentDraftFilters {
  status?: 'DRAFT' | 'APPROVED' | 'SKIPPED';
  dueOnOrBefore?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface RecurringPaymentApproveResult {
  draftId: string;
  journalSourceId: string;
}

export interface RecurringPaymentSkipResult {
  draftId: string;
}

type RecurringPaymentServiceConfig = {
  templatesEndpoint: string;
  draftsEndpoint: string;
  generateEndpoint: string;
  approveEndpoint: string;
  skipEndpoint: string;
};

export function createRecurringPaymentService<
  TTemplate extends RecurringPaymentTemplateDTO,
  TDraft extends RecurringPaymentDraftDTO<TTemplate>,
>(config: RecurringPaymentServiceConfig) {
  return class RecurringPaymentService extends BaseService {
    protected static templatesEndpoint = config.templatesEndpoint;
    protected static draftsEndpoint = config.draftsEndpoint;
    protected static generateEndpoint = config.generateEndpoint;
    protected static approveEndpoint = config.approveEndpoint;
    protected static skipEndpoint = config.skipEndpoint;

    static async getTemplates(): Promise<TTemplate[]> {
      return this.get<TTemplate[]>(this.templatesEndpoint);
    }

    static async createTemplate(
      payload: RecurringPaymentTemplateCreatePayload
    ): Promise<TTemplate> {
      return this.post<TTemplate>(this.templatesEndpoint, payload);
    }

    static async updateTemplate(
      id: string,
      payload: RecurringPaymentTemplateUpdatePayload
    ): Promise<TTemplate> {
      return this.patch<TTemplate>(this.templatesEndpoint, {
        id,
        ...payload,
      });
    }

    static async deleteTemplateById(id: string): Promise<TTemplate> {
      return this.request<TTemplate>(
        `${this.templatesEndpoint}?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );
    }

    static async generate(
      payload?: RecurringPaymentGeneratePayload
    ): Promise<RecurringPaymentGenerateResult> {
      return this.post<RecurringPaymentGenerateResult>(
        this.generateEndpoint,
        payload ?? {}
      );
    }

    static async getDrafts(
      params?: RecurringPaymentDraftFilters
    ): Promise<TDraft[]> {
      const qs = new URLSearchParams();
      if (params?.status) {
        qs.set('status', params.status);
      }
      if (params?.dueOnOrBefore) {
        qs.set('dueOnOrBefore', params.dueOnOrBefore);
      }
      if (params?.dueFrom) {
        qs.set('dueFrom', params.dueFrom);
      }
      if (params?.dueTo) {
        qs.set('dueTo', params.dueTo);
      }

      const suffix = qs.toString() ? `?${qs.toString()}` : '';

      return this.get<TDraft[]>(`${this.draftsEndpoint}${suffix}`);
    }

    static async approveDraft(
      draftId: string
    ): Promise<RecurringPaymentApproveResult> {
      return this.post<RecurringPaymentApproveResult>(this.approveEndpoint, {
        draftId,
      });
    }

    static async skipDraft(
      draftId: string
    ): Promise<RecurringPaymentSkipResult> {
      return this.post<RecurringPaymentSkipResult>(this.skipEndpoint, {
        draftId,
      });
    }
  };
}