import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockService, mockSchemas } = vi.hoisted(() => ({
  mockService: {
    listVehicleAssignments: vi.fn(),
    createVehicleAssignment: vi.fn(),
    updateVehicleAssignment: vi.fn(),
    softDeleteVehicleAssignment: vi.fn(),
  },
  mockSchemas: {
    draft: { parse: vi.fn((value) => value) },
    update: { parse: vi.fn((value) => value) },
  },
}));

vi.mock(
  '@/modules/trucking/operations/vehicle-assignments/api/vehicleAssignmentsService',
  () => ({
    listVehicleAssignments: mockService.listVehicleAssignments,
    createVehicleAssignment: mockService.createVehicleAssignment,
    updateVehicleAssignment: mockService.updateVehicleAssignment,
    softDeleteVehicleAssignment: mockService.softDeleteVehicleAssignment,
  })
);

vi.mock(
  '@/modules/trucking/operations/vehicle-assignments/api/vehicleAssignmentsValidation',
  () => ({
    vehicleAssignmentDraftSchema: mockSchemas.draft,
    vehicleAssignmentUpdateSchema: mockSchemas.update,
  })
);

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET, POST } from '@/app/api/trucking/vehicle-assignments/route';
import {
  DELETE as DELETE_BY_ID,
  PUT as PUT_BY_ID,
} from '@/app/api/trucking/vehicle-assignments/[id]/route';

describe('Trucking vehicle-assignments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists vehicle assignments', async () => {
    mockService.listVehicleAssignments.mockResolvedValue([{ id: 'assign-1' }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: 'assign-1' }]);
  });

  it('creates a vehicle assignment', async () => {
    mockService.createVehicleAssignment.mockResolvedValue({ id: 'assign-2' });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/vehicle-assignments', {
        method: 'POST',
        body: JSON.stringify({ vehicleId: 'TRK-1', plateNo: 'ABC123' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe('assign-2');
  });

  it('updates a vehicle assignment by id', async () => {
    mockService.updateVehicleAssignment.mockResolvedValue({ id: 'assign-3' });

    const response = await PUT_BY_ID(
      new NextRequest(
        'http://localhost/api/trucking/vehicle-assignments/assign-3',
        {
          method: 'PUT',
          body: JSON.stringify({ status: 'active' }),
        }
      ),
      { params: { id: 'assign-3' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe('assign-3');
  });

  it('soft deletes a vehicle assignment by id', async () => {
    mockService.softDeleteVehicleAssignment.mockResolvedValue(undefined);

    const response = await DELETE_BY_ID(
      new NextRequest(
        'http://localhost/api/trucking/vehicle-assignments/assign-4',
        {
          method: 'DELETE',
        }
      ),
      { params: { id: 'assign-4' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockService.softDeleteVehicleAssignment).toHaveBeenCalledWith(
      'assign-4'
    );
  });
});
