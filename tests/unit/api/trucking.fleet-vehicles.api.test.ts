import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockService, mockSchema } = vi.hoisted(() => ({
  mockService: {
    listFleetVehicles: vi.fn(),
    createFleetVehicle: vi.fn(),
    getFleetVehicle: vi.fn(),
    updateFleetVehicle: vi.fn(),
  },
  mockSchema: {
    parse: vi.fn((value) => value),
  },
}));

vi.mock(
  '@/modules/trucking/operations/fleet-registry/api/fleetVehiclesService',
  () => ({
    listFleetVehicles: mockService.listFleetVehicles,
    createFleetVehicle: mockService.createFleetVehicle,
    getFleetVehicle: mockService.getFleetVehicle,
    updateFleetVehicle: mockService.updateFleetVehicle,
  })
);

vi.mock(
  '@/modules/trucking/operations/fleet-registry/api/fleetVehiclesValidation',
  () => ({
    fleetVehiclePayloadSchema: mockSchema,
  })
);

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, POST } from '@/app/api/trucking/fleet-vehicles/route';
import {
  GET as GET_BY_ID,
  PATCH as PATCH_BY_ID,
} from '@/app/api/trucking/fleet-vehicles/[identifier]/route';

describe('Trucking fleet-vehicles API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists fleet vehicles', async () => {
    mockService.listFleetVehicles.mockResolvedValue([{ id: 'truck-1' }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: 'truck-1' }]);
  });

  it('creates a fleet vehicle', async () => {
    mockService.createFleetVehicle.mockResolvedValue({ id: 'truck-2' });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/fleet-vehicles', {
        method: 'POST',
        body: JSON.stringify({ truckId: 'TRK-2' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe('truck-2');
  });

  it('returns 404 when a fleet vehicle is missing', async () => {
    mockService.getFleetVehicle.mockResolvedValue(null);

    const response = await GET_BY_ID(new Request('http://localhost'), {
      params: { identifier: 'TRK-404' },
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Vehicle not found');
  });

  it('updates a fleet vehicle by identifier', async () => {
    mockService.updateFleetVehicle.mockResolvedValue({ id: 'truck-3' });

    const response = await PATCH_BY_ID(
      new NextRequest('http://localhost/api/trucking/fleet-vehicles/TRK-3', {
        method: 'PATCH',
        body: JSON.stringify({ truckId: 'TRK-3' }),
      }),
      { params: { identifier: 'TRK-3' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('truck-3');
  });
});
