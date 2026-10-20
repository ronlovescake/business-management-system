import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockGetSummary } = vi.hoisted(() => ({
  mockGetSummary: vi.fn(),
}));

vi.mock('@/modules/household/dashboard/api/service', () => ({
  householdDashboardService: { getSummary: mockGetSummary },
  HouseholdDashboardService: class {},
}));

import { GET } from '@/app/api/household/dashboard/route';

function request(range?: string) {
  const suffix = range ? `?range=${encodeURIComponent(range)}` : '';
  return new NextRequest(getTestApiUrl(`/api/household/dashboard${suffix}`));
}

describe('GET /api/household/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSummary.mockResolvedValue({ range: 'ytd' });
  });

  it('defaults to year to date', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mockGetSummary).toHaveBeenCalledWith('ytd');
  });

  it('passes a supported range to the dashboard service', async () => {
    const response = await GET(request('last30days'));

    expect(response.status).toBe(200);
    expect(mockGetSummary).toHaveBeenCalledWith('last30days');
  });

  it('rejects an unsupported range without calling the service', async () => {
    const response = await GET(request('last90days'));

    expect(response.status).toBe(400);
    expect(mockGetSummary).not.toHaveBeenCalled();
  });
});
