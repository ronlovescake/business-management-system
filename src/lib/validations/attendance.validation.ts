import { z } from 'zod';

/**
 * Attendance Validation Schema
 * Comprehensive validation for attendance records
 */

/**
 * Time validation regex (HH:MM format, 24-hour)
 */
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Date validation regex (YYYY-MM-DD format)
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Attendance Status enum
 */
const attendanceStatusSchema = z.enum(
  ['present', 'late', 'absent', 'on-leave'],
  {
    errorMap: () => ({
      message: 'Attendance status must be: present, late, absent, or on-leave',
    }),
  }
);

/**
 * Time field validation
 */
const timeFieldSchema = z
  .string()
  .trim()
  .regex(timeRegex, 'Time must be in HH:MM format (e.g., 09:00, 17:30)');

/**
 * Optional time field validation
 */
const optionalTimeFieldSchema = z
  .string()
  .trim()
  .regex(timeRegex, 'Time must be in HH:MM format')
  .optional()
  .nullable();

/**
 * Base attendance schema without refinements
 */
const baseAttendanceSchema = z.object({
  // Employee information
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50),
  employeeName: z.string().trim().min(1, 'Employee name is required').max(255),
  department: z.string().trim().min(1, 'Department is required').max(100),
  position: z.string().trim().min(1, 'Position is required').max(100),

  // Attendance details
  date: z
    .string()
    .regex(dateRegex, 'Date must be in YYYY-MM-DD format')
    .refine((date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    }, 'Invalid date'),

  timeIn: timeFieldSchema,
  timeOut: timeFieldSchema,

  // Break times (optional)
  break1Start: optionalTimeFieldSchema,
  break1End: optionalTimeFieldSchema,
  lunchStart: optionalTimeFieldSchema,
  lunchEnd: optionalTimeFieldSchema,
  break2Start: optionalTimeFieldSchema,
  break2End: optionalTimeFieldSchema,

  // Hours & Status
  totalHours: z.number().nonnegative('Total hours cannot be negative'),
  status: attendanceStatusSchema,

  // Additional information
  details: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

/**
 * Full attendance schema with time validations
 */
export const attendanceSchema = baseAttendanceSchema
  .refine(
    (data) => {
      // Validate that timeOut is after timeIn
      const [inHour, inMin] = data.timeIn.split(':').map(Number);
      const [outHour, outMin] = data.timeOut.split(':').map(Number);
      const timeInMinutes = inHour * 60 + inMin;
      const timeOutMinutes = outHour * 60 + outMin;
      return timeOutMinutes > timeInMinutes;
    },
    {
      message: 'Time out must be after time in',
      path: ['timeOut'],
    }
  )
  .refine(
    (data) => {
      // Validate break times if provided
      if (data.break1Start && data.break1End) {
        const [startHour, startMin] = data.break1Start.split(':').map(Number);
        const [endHour, endMin] = data.break1End.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return endMinutes > startMinutes;
      }
      return true;
    },
    {
      message: 'Break 1 end time must be after start time',
      path: ['break1End'],
    }
  )
  .refine(
    (data) => {
      // Validate lunch times if provided
      if (data.lunchStart && data.lunchEnd) {
        const [startHour, startMin] = data.lunchStart.split(':').map(Number);
        const [endHour, endMin] = data.lunchEnd.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return endMinutes > startMinutes;
      }
      return true;
    },
    {
      message: 'Lunch end time must be after start time',
      path: ['lunchEnd'],
    }
  )
  .refine(
    (data) => {
      // Validate break 2 times if provided
      if (data.break2Start && data.break2End) {
        const [startHour, startMin] = data.break2Start.split(':').map(Number);
        const [endHour, endMin] = data.break2End.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return endMinutes > startMinutes;
      }
      return true;
    },
    {
      message: 'Break 2 end time must be after start time',
      path: ['break2End'],
    }
  );

/**
 * Partial schema for updates
 */
export const attendanceUpdateSchema = baseAttendanceSchema.partial();

/**
 * Bulk attendance import schema
 */
export const bulkAttendanceSchema = z.array(attendanceSchema).min(1, {
  message: 'At least one attendance record is required for bulk import',
});

/**
 * Attendance query parameters schema
 */
export const attendanceQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
});

/**
 * Type inference from schemas
 */
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>;
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;

/**
 * Validation helper functions
 */
export function validateAttendance(data: unknown) {
  return attendanceSchema.safeParse(data);
}

export function validateAttendanceUpdate(data: unknown) {
  return attendanceUpdateSchema.safeParse(data);
}

export function validateBulkAttendance(data: unknown) {
  return bulkAttendanceSchema.safeParse(data);
}

export function validateAttendanceQuery(data: unknown) {
  return attendanceQuerySchema.safeParse(data);
}

/**
 * Format Zod validation errors
 */
export function formatValidationErrors(
  errors: z.ZodError
): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });
  return formattedErrors;
}

/**
 * Calculate total hours from time in/out and breaks
 */
export function calculateTotalHours(
  timeIn: string,
  timeOut: string,
  breaks?: { start: string; end: string }[]
): number {
  const [inHour, inMin] = timeIn.split(':').map(Number);
  const [outHour, outMin] = timeOut.split(':').map(Number);

  let totalMinutes = outHour * 60 + outMin - (inHour * 60 + inMin);

  // Subtract break times
  if (breaks) {
    for (const breakTime of breaks) {
      const [startHour, startMin] = breakTime.start.split(':').map(Number);
      const [endHour, endMin] = breakTime.end.split(':').map(Number);
      const breakMinutes = endHour * 60 + endMin - (startHour * 60 + startMin);
      totalMinutes -= breakMinutes;
    }
  }

  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
}
