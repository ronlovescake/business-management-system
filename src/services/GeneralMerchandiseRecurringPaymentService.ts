import { BaseService } from './BaseService';

export interface GeneralMerchandiseRecurringPaymentTemplateDTO {
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

export interface GeneralMerchandiseRecurringPaymentDraftDTO {
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
  template: GeneralMerchandiseRecurringPaymentTemplateDTO;
}

export class GeneralMerchandiseRecurringPaymentService extends BaseService {
  protected static templatesEndpoint =
    '/general-merchandise/accounting/recurring-payments/templates';
  protected static draftsEndpoint =
    '/general-merchandise/accounting/recurring-payments/drafts';

  static async getTemplates(): Promise<
    GeneralMerchandiseRecurringPaymentTemplateDTO[]
  > {
    return this.get<GeneralMerchandiseRecurringPaymentTemplateDTO[]>(
      this.templatesEndpoint
    );
  }

  static async createTemplate(payload: {
    name: string;
    kind: 'LOAN' | 'EXPENSE';
    amount: number;
    frequency?: 'MONTHLY';
    dayOfMonth: number;
    nextDueDate: string; // ISO
    endDate?: string | null; // ISO
    debitAccount: string;
    debitTag?: string | null;
    creditAccount: string;
    creditTag?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }): Promise<GeneralMerchandiseRecurringPaymentTemplateDTO> {
    return this.post<GeneralMerchandiseRecurringPaymentTemplateDTO>(
      this.templatesEndpoint,
      payload
    );
  }

  static async updateTemplate(
    id: string,
    payload: Partial<{
      name: string;
      kind: 'LOAN' | 'EXPENSE';
      amount: number;
      frequency: 'MONTHLY';
      dayOfMonth: number;
      nextDueDate: string; // ISO
      endDate: string | null; // ISO
      debitAccount: string;
      debitTag: string | null;
      creditAccount: string;
      creditTag: string | null;
      notes: string | null;
      isActive: boolean;
    }>
  ): Promise<GeneralMerchandiseRecurringPaymentTemplateDTO> {
    return this.patch<GeneralMerchandiseRecurringPaymentTemplateDTO>(
      this.templatesEndpoint,
      {
        id,
        ...payload,
      }
    );
  }

  static async deleteTemplateById(
    id: string
  ): Promise<GeneralMerchandiseRecurringPaymentTemplateDTO> {
    return this.request<GeneralMerchandiseRecurringPaymentTemplateDTO>(
      `${this.templatesEndpoint}?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  }

  static async generate(payload?: { upToDate?: string }): Promise<{
    created: number;
    skipped: number;
    upToDate: string;
  }> {
    return this.post<{ created: number; skipped: number; upToDate: string }>(
      '/general-merchandise/accounting/recurring-payments/generate',
      payload ?? {}
    );
  }

  static async getDrafts(params?: {
    status?: 'DRAFT' | 'APPROVED' | 'SKIPPED';
    dueOnOrBefore?: string;
    dueFrom?: string;
    dueTo?: string;
  }): Promise<GeneralMerchandiseRecurringPaymentDraftDTO[]> {
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

    return this.get<GeneralMerchandiseRecurringPaymentDraftDTO[]>(
      `${this.draftsEndpoint}${suffix}`
    );
  }

  static async approveDraft(draftId: string): Promise<{
    draftId: string;
    journalSourceId: string;
  }> {
    return this.post<{ draftId: string; journalSourceId: string }>(
      '/general-merchandise/accounting/recurring-payments/drafts/approve',
      { draftId }
    );
  }

  static async skipDraft(draftId: string): Promise<{ draftId: string }> {
    return this.post<{ draftId: string }>(
      '/general-merchandise/accounting/recurring-payments/drafts/skip',
      { draftId }
    );
  }
}
