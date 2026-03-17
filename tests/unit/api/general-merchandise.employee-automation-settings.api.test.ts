import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSettings, mockUpdateSettings, mockRunAutomation, mockLogger } =
  vi.hoisted(() => ({
    mockGetSettings: vi.fn(),
    mockUpdateSettings: vi.fn(),
    mockRunAutomation: vi.fn(),
    mockLogger: {
      error: vi.fn(),
    },
  }));

vi.mock('@/lib/settings/generalMerchandiseEmployeeAutomation', () => ({
  getGeneralMerchandiseEmployeeAutomationSettings: mockGetSettings,
  updateGeneralMerchandiseEmployeeAutomationSettings: mockUpdateSettings,
}));

vi.mock('@/lib/automation/stayInAutoPresenceGeneralMerchandise', () => ({
  runGeneralMerchandiseStayInAutoPresenceAutomation: mockRunAutomation,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  GET,
  PUT,
  POST,
} from '@/app/api/general-merchandise/employee-automation-settings/route';

describe('GM employee automation settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns GM employee automation settings on GET', async () => {
    mockGetSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceStartHour: 7,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      stayInAutoPresenceEnabled: true,
      stayInAutoPresenceStartHour: 7,
    });
  });

  it('maps validation errors to 400 on PUT', async () => {
    const validationError = new Error('Start hour must be between 0 and 23');
    validationError.name = 'ValidationError';
    mockUpdateSettings.mockRejectedValue(validationError);

    const response = await PUT(
      new NextRequest(
        'http://localhost/api/general-merchandise/employee-automation-settings',
        {
          method: 'PUT',
          body: JSON.stringify({ stayInAutoPresenceStartHour: 24 }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Start hour must be between 0 and 23');
  });

  it('updates settings on PUT', async () => {
    mockUpdateSettings.mockResolvedValue({
      stayInAutoPresenceEnabled: false,
      stayInAutoPresenceStartHour: 6,
    });

    const response = await PUT(
      new NextRequest(
        'http://localhost/api/general-merchandise/employee-automation-settings',
        {
          method: 'PUT',
          body: JSON.stringify({ stayInAutoPresenceEnabled: false }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stayInAutoPresenceEnabled).toBe(false);
  });

  it('runs the stay-in automation on POST', async () => {
    mockRunAutomation.mockResolvedValue({ processedEmployees: 3, created: 2 });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result).toEqual({ processedEmployees: 3, created: 2 });
  });
});
