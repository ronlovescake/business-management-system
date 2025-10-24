/**
 * Soft Delete Restore Pattern
 *
 * Provides utilities for restoring soft-deleted records
 * with proper validation and type safety.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { Attendance, Employee, Payroll, Schedule } from '@prisma/client';

/**
 * Models that can participate in restore operations.
 * Extend this list when new workspace entities adopt soft delete.
 */
export const RESTORABLE_MODELS = [
  'employee',
  'attendance',
  'schedule',
  'payroll',
] as const;

type SoftDeleteModel = (typeof RESTORABLE_MODELS)[number];

type ModelEntityMap = {
  employee: Employee;
  attendance: Attendance;
  schedule: Schedule;
  payroll: Payroll;
};

type WhereInputForModel<M extends SoftDeleteModel> = M extends 'employee'
  ? Prisma.EmployeeWhereInput
  : M extends 'attendance'
    ? Prisma.AttendanceWhereInput
    : M extends 'schedule'
      ? Prisma.ScheduleWhereInput
      : Prisma.PayrollWhereInput;

type CreateInputForModel<M extends SoftDeleteModel> = M extends 'employee'
  ? Prisma.EmployeeCreateInput
  : M extends 'attendance'
    ? Prisma.AttendanceCreateInput
    : M extends 'schedule'
      ? Prisma.ScheduleCreateInput
      : Prisma.PayrollCreateInput;

type UpdateInputForModel<M extends SoftDeleteModel> = M extends 'employee'
  ? Prisma.EmployeeUpdateInput
  : M extends 'attendance'
    ? Prisma.AttendanceUpdateInput
    : M extends 'schedule'
      ? Prisma.ScheduleUpdateInput
      : Prisma.PayrollUpdateInput;

type ModelIdType<M extends SoftDeleteModel> = ModelEntityMap[M]['id'];

const parseId = <M extends SoftDeleteModel>(
  model: M,
  rawId: string | number
): ModelIdType<M> => {
  if (model === 'employee') {
    const parsed = typeof rawId === 'number' ? rawId : Number(rawId);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid employee id: ${rawId}`);
    }
    return parsed as ModelIdType<M>;
  }

  return rawId.toString() as ModelIdType<M>;
};

interface RestoreOptions<M extends SoftDeleteModel> {
  model: M;
  id: string | ModelIdType<M>;
  userId?: string;
  reason?: string;
}

interface RestoreResult<M extends SoftDeleteModel> {
  success: boolean;
  record?: ModelEntityMap[M];
  error?: string;
  warnings?: string[];
}

interface UpsertOptions<M extends SoftDeleteModel> {
  model: M;
  where: WhereInputForModel<M>;
  create: CreateInputForModel<M>;
  update: UpdateInputForModel<M>;
  userId?: string;
}

export async function restoreRecord<M extends SoftDeleteModel>(
  options: RestoreOptions<M>
): Promise<RestoreResult<M>> {
  switch (options.model) {
    case 'employee':
      return (await restoreEmployee(
        options as RestoreOptions<'employee'>
      )) as RestoreResult<M>;
    case 'attendance':
      return (await restoreAttendance(
        options as RestoreOptions<'attendance'>
      )) as RestoreResult<M>;
    case 'schedule':
      return (await restoreSchedule(
        options as RestoreOptions<'schedule'>
      )) as RestoreResult<M>;
    case 'payroll':
      return (await restorePayroll(
        options as RestoreOptions<'payroll'>
      )) as RestoreResult<M>;
    default:
      return {
        success: false,
        error: `Model '${options.model}' is not restorable`,
      } as RestoreResult<M>;
  }
}

export async function upsertWithRestore<M extends SoftDeleteModel>(
  options: UpsertOptions<M>
): Promise<ModelEntityMap[M]> {
  switch (options.model) {
    case 'employee':
      return upsertEmployee(options as UpsertOptions<'employee'>) as Promise<
        ModelEntityMap[M]
      >;
    case 'attendance':
      return upsertAttendance(
        options as UpsertOptions<'attendance'>
      ) as Promise<ModelEntityMap[M]>;
    case 'schedule':
      return upsertSchedule(options as UpsertOptions<'schedule'>) as Promise<
        ModelEntityMap[M]
      >;
    case 'payroll':
      return upsertPayroll(options as UpsertOptions<'payroll'>) as Promise<
        ModelEntityMap[M]
      >;
    default:
      throw new Error(
        `Model '${options.model}' is not supported for upsertWithRestore`
      );
  }
}

export async function bulkRestore<M extends SoftDeleteModel>(
  model: M,
  ids: Array<string | ModelIdType<M>>,
  userId?: string
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ id: string | number; error: string }>;
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ id: string | number; error: string }>,
  };

  for (const id of ids) {
    const outcome = await restoreRecord({ model, id, userId });
    if (outcome.success) {
      results.success += 1;
    } else {
      results.failed += 1;
      results.errors.push({ id, error: outcome.error ?? 'Unknown error' });
    }
  }

  return results;
}

export async function findDeletedRecords<M extends SoftDeleteModel>(
  model: M,
  filters?: Partial<WhereInputForModel<M>>
): Promise<ModelEntityMap[M][]> {
  switch (model) {
    case 'employee':
      return prisma.employee.findMany({
        where: {
          ...(filters as Prisma.EmployeeWhereInput | undefined),
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: 'desc' },
      }) as Promise<ModelEntityMap[M][]>;
    case 'attendance':
      return prisma.attendance.findMany({
        where: {
          ...(filters as Prisma.AttendanceWhereInput | undefined),
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: 'desc' },
      }) as Promise<ModelEntityMap[M][]>;
    case 'schedule':
      return prisma.schedule.findMany({
        where: {
          ...(filters as Prisma.ScheduleWhereInput | undefined),
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: 'desc' },
      }) as Promise<ModelEntityMap[M][]>;
    case 'payroll':
      return prisma.payroll.findMany({
        where: {
          ...(filters as Prisma.PayrollWhereInput | undefined),
          deletedAt: { not: null },
        },
        orderBy: { deletedAt: 'desc' },
      }) as Promise<ModelEntityMap[M][]>;
    default:
      return [] as ModelEntityMap[M][];
  }
}

const createDatabaseErrorResult = (error: unknown, fallback: string) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      success: false,
      error: `Database error: ${error.message}`,
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
};

async function restoreEmployee(
  options: RestoreOptions<'employee'>
): Promise<RestoreResult<'employee'>> {
  const id = parseId('employee', options.id);
  const warnings: string[] = [];

  try {
    const existing = await prisma.employee.findUnique({ where: { id } });

    if (!existing) {
      return { success: false, error: 'Record not found' };
    }

    if (!existing.deletedAt) {
      return {
        success: false,
        error: 'Record is not deleted - nothing to restore',
      };
    }

    const duplicateEmployee = await prisma.employee.findFirst({
      where: {
        employeeId: existing.employeeId,
        deletedAt: null,
        id: { not: existing.id },
      },
    });

    if (duplicateEmployee) {
      return {
        success: false,
        error: `Cannot restore: Another active employee with ID '${existing.employeeId}' already exists`,
      };
    }

    if (existing.email) {
      const emailConflict = await prisma.employee.findFirst({
        where: {
          email: existing.email,
          deletedAt: null,
          id: { not: existing.id },
        },
      });

      if (emailConflict) {
        warnings.push(
          `Email '${existing.email}' is already in use by another employee`
        );
      }
    }

    if (existing.phone) {
      const phoneConflict = await prisma.employee.findFirst({
        where: {
          phone: existing.phone,
          deletedAt: null,
          id: { not: existing.id },
        },
      });

      if (phoneConflict) {
        warnings.push(
          `Phone '${existing.phone}' is already in use by another employee`
        );
      }
    }

    const restored = await prisma.employee.update({
      where: { id },
      data: { deletedAt: null, updatedAt: new Date() },
    });

    return {
      success: true,
      record: restored,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return createDatabaseErrorResult(error, 'Unknown error occurred');
  }
}

async function restoreAttendance(
  options: RestoreOptions<'attendance'>
): Promise<RestoreResult<'attendance'>> {
  const id = parseId('attendance', options.id);

  try {
    const existing = await prisma.attendance.findUnique({ where: { id } });

    if (!existing) {
      return { success: false, error: 'Record not found' };
    }

    if (!existing.deletedAt) {
      return {
        success: false,
        error: 'Record is not deleted - nothing to restore',
      };
    }

    const employee = await prisma.employee.findFirst({
      where: {
        employeeId: existing.employeeId,
        deletedAt: null,
      },
    });

    if (!employee) {
      return {
        success: false,
        error: `Cannot restore: Employee '${existing.employeeId}' not found or is deleted`,
      };
    }

    const duplicateAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: existing.employeeId,
        date: existing.date,
        deletedAt: null,
        id: { not: existing.id },
      },
    });

    if (duplicateAttendance) {
      return {
        success: false,
        error: `Cannot restore: Active attendance record already exists for ${existing.employeeId} on ${existing.date}`,
      };
    }

    const restored = await prisma.attendance.update({
      where: { id },
      data: { deletedAt: null, updatedAt: new Date() },
    });

    return { success: true, record: restored };
  } catch (error) {
    return createDatabaseErrorResult(error, 'Unknown error occurred');
  }
}

async function restoreSchedule(
  options: RestoreOptions<'schedule'>
): Promise<RestoreResult<'schedule'>> {
  const id = parseId('schedule', options.id);

  try {
    const existing = await prisma.schedule.findUnique({ where: { id } });

    if (!existing) {
      return { success: false, error: 'Record not found' };
    }

    if (!existing.deletedAt) {
      return {
        success: false,
        error: 'Record is not deleted - nothing to restore',
      };
    }

    const employee = await prisma.employee.findFirst({
      where: {
        employeeId: existing.employeeId,
        deletedAt: null,
      },
    });

    if (!employee) {
      return {
        success: false,
        error: `Cannot restore: Employee '${existing.employeeId}' not found or is deleted`,
      };
    }

    const duplicateSchedule = await prisma.schedule.findFirst({
      where: {
        employeeId: existing.employeeId,
        date: existing.date,
        shiftType: existing.shiftType,
        deletedAt: null,
        id: { not: existing.id },
      },
    });

    if (duplicateSchedule) {
      return {
        success: false,
        error: `Cannot restore: Active schedule already exists for ${existing.employeeId} on ${existing.date} (${existing.shiftType})`,
      };
    }

    const restored = await prisma.schedule.update({
      where: { id },
      data: { deletedAt: null, updatedAt: new Date() },
    });

    return { success: true, record: restored };
  } catch (error) {
    return createDatabaseErrorResult(error, 'Unknown error occurred');
  }
}

async function restorePayroll(
  options: RestoreOptions<'payroll'>
): Promise<RestoreResult<'payroll'>> {
  const id = parseId('payroll', options.id);

  try {
    const existing = await prisma.payroll.findUnique({ where: { id } });

    if (!existing) {
      return { success: false, error: 'Record not found' };
    }

    if (!existing.deletedAt) {
      return {
        success: false,
        error: 'Record is not deleted - nothing to restore',
      };
    }

    const employee = await prisma.employee.findFirst({
      where: {
        employeeId: existing.employeeId,
        deletedAt: null,
      },
    });

    if (!employee) {
      return {
        success: false,
        error: `Cannot restore: Employee '${existing.employeeId}' not found or is deleted`,
      };
    }

    const duplicatePayroll = await prisma.payroll.findFirst({
      where: {
        employeeId: existing.employeeId,
        periodStart: existing.periodStart,
        periodEnd: existing.periodEnd,
        deletedAt: null,
        id: { not: existing.id },
      },
    });

    if (duplicatePayroll) {
      return {
        success: false,
        error: `Cannot restore: Active payroll already exists for ${existing.employeeId} in period ${existing.periodStart} - ${existing.periodEnd}`,
      };
    }

    const restored = await prisma.payroll.update({
      where: { id },
      data: { deletedAt: null, updatedAt: new Date() },
    });

    return { success: true, record: restored };
  } catch (error) {
    return createDatabaseErrorResult(error, 'Unknown error occurred');
  }
}

async function upsertEmployee(
  options: UpsertOptions<'employee'>
): Promise<Employee> {
  const existing = await prisma.employee.findFirst({ where: options.where });

  if (!existing) {
    return prisma.employee.create({ data: options.create });
  }

  if (existing.deletedAt) {
    await restoreEmployee({ model: 'employee', id: existing.id });
  }

  return prisma.employee.update({
    where: { id: existing.id },
    data: {
      ...options.update,
      updatedAt: new Date(),
    },
  });
}

async function upsertAttendance(
  options: UpsertOptions<'attendance'>
): Promise<Attendance> {
  const existing = await prisma.attendance.findFirst({ where: options.where });

  if (!existing) {
    return prisma.attendance.create({ data: options.create });
  }

  if (existing.deletedAt) {
    await restoreAttendance({ model: 'attendance', id: existing.id });
  }

  return prisma.attendance.update({
    where: { id: existing.id },
    data: {
      ...options.update,
      updatedAt: new Date(),
    },
  });
}

async function upsertSchedule(
  options: UpsertOptions<'schedule'>
): Promise<Schedule> {
  const existing = await prisma.schedule.findFirst({ where: options.where });

  if (!existing) {
    return prisma.schedule.create({ data: options.create });
  }

  if (existing.deletedAt) {
    await restoreSchedule({ model: 'schedule', id: existing.id });
  }

  return prisma.schedule.update({
    where: { id: existing.id },
    data: {
      ...options.update,
      updatedAt: new Date(),
    },
  });
}

async function upsertPayroll(
  options: UpsertOptions<'payroll'>
): Promise<Payroll> {
  const existing = await prisma.payroll.findFirst({ where: options.where });

  if (!existing) {
    return prisma.payroll.create({ data: options.create });
  }

  if (existing.deletedAt) {
    await restorePayroll({ model: 'payroll', id: existing.id });
  }

  return prisma.payroll.update({
    where: { id: existing.id },
    data: {
      ...options.update,
      updatedAt: new Date(),
    },
  });
}
