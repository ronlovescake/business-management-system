import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClothingRecurringPaymentService } from '@/services/ClothingRecurringPaymentService';
import { GeneralMerchandiseRecurringPaymentService } from '@/services/GeneralMerchandiseRecurringPaymentService';

describe('recurring payment service factory', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('uses the clothing templates endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await ClothingRecurringPaymentService.getTemplates();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/accounting/recurring-payments/templates',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('builds clothing draft filters into the query string', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    await ClothingRecurringPaymentService.getDrafts({
      status: 'DRAFT',
      dueFrom: '2026-04-01',
      dueTo: '2026-04-30',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/accounting/recurring-payments/drafts?status=DRAFT&dueFrom=2026-04-01&dueTo=2026-04-30',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('uses the general merchandise approve endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { draftId: 'draft-1', journalSourceId: 'journal-1' },
      }),
    });

    await GeneralMerchandiseRecurringPaymentService.approveDraft('draft-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/general-merchandise/accounting/recurring-payments/drafts/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ draftId: 'draft-1' }),
      })
    );
  });
});