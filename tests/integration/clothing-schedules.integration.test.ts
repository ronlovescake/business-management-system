import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import type * as NextAuth from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { getServerSession as getRootSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { POST, PATCH } from '@/app/api/schedules/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({
    id: 'integration-admin',
    role: 'ADMIN',
  })),
}));
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(),
}));

let barrier: {
  employeeId: string;
  date: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
} | null = null;

prisma.$use(async (parameters, next) => {
  const result = await next(parameters);
  const current = barrier;
  const where = parameters.args?.where;
  const pairs = where?.OR ?? [where];
  if (
    current &&
    parameters.model === 'Schedule' &&
    ['findMany', 'findFirst'].includes(parameters.action) &&
    pairs.some(
      (pair: { employeeId?: string; date?: string } | undefined) =>
        pair?.employeeId === current.employeeId && pair?.date === current.date
    )
  ) {
    current.reads++;
    if (current.reads === 2) {
      current.release();
    }
    await current.ready;
  }
  return result;
});

beforeEach(() => {
  barrier = null;
  const session = {
    user: {
      id: 'integration-admin',
      name: 'Integration Admin',
      email: 'integration@example.test',
      role: 'ADMIN',
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getRootSession).mockResolvedValue(session);
});

async function createEmployee() {
  const employeeId = `S-${randomUUID().slice(0, 12)}`;
  return prisma.employee.create({
    data: {
      employeeId,
      firstName: 'Schedule',
      lastName: 'Fixture',
      name: employeeId,
      contact: 'test-only',
      department: 'Test',
      position: 'Test',
      jobTitle: 'Test',
      status: 'active',
      hireDate: '2026-01-01',
      basicSalary: 26000,
    },
  });
}

function coordinate(employeeId: string, date: string) {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  barrier = { employeeId, date, reads: 0, ready, release };
}

const payload = (
  employee: { employeeId: string; name: string },
  date: string,
  shiftType: string
) => ({
  employeeId: employee.employeeId,
  employeeName: employee.name,
  date,
  shiftType,
  startTime: '08:00',
  endTime: '17:00',
  position: 'Test',
  department: 'Test',
  status: 'scheduled',
});

describe('Integration - clothing schedule concurrency', () => {
  it('allows only one of two different-shift creates for the same employee/date', async () => {
    const employee = await createEmployee();
    const date = '2026-10-24';
    coordinate(employee.employeeId, date);
    const responses = await Promise.all(
      ['morning', 'afternoon'].map((shift) =>
        POST(
          new NextRequest(getTestApiUrl('/api/schedules'), {
            method: 'POST',
            body: JSON.stringify(payload(employee, date, shift)),
          })
        )
      )
    );
    barrier = null;
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.schedule.count({
        where: { employeeId: employee.employeeId, date, deletedAt: null },
      })
    ).toBe(1);
  });

  it('allows only one of two schedule moves onto the same employee/date', async () => {
    const employee = await createEmployee();
    const first = await prisma.schedule.create({
      data: payload(employee, '2026-10-23', 'morning'),
    });
    const second = await prisma.schedule.create({
      data: payload(employee, '2026-10-25', 'afternoon'),
    });
    const date = '2026-10-24';
    coordinate(employee.employeeId, date);
    const responses = await Promise.all(
      [first, second].map((record) =>
        PATCH(
          new NextRequest(getTestApiUrl('/api/schedules'), {
            method: 'PATCH',
            body: JSON.stringify({ id: record.id, date }),
          })
        )
      )
    );
    barrier = null;
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      await prisma.schedule.count({
        where: { employeeId: employee.employeeId, date, deletedAt: null },
      })
    ).toBe(1);
  });
});
