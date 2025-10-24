import { z } from 'zod';

/**
 * Schedule Validation Schema
 */

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const shiftTypeSchema = z.enum(['morning', 'afternoon', 'night', 'full-day'], {
  errorMap: () => ({
    message: 'Shift type must be: morning, afternoon, night, or full-day',
  }),
});

const scheduleStatusSchema = z.enum(
  ['scheduled', 'completed', 'cancelled', 'on-leave'],
  {
    errorMap: () => ({
      message:
        'Schedule status must be: scheduled, completed, cancelled, or on-leave',
    }),
  }
);

const scheduleSourceSchema = z.enum(['manual', 'template', 'recurrence'], {
  errorMap: () => ({
    message: 'Schedule source must be: manual, template, or recurrence',
  }),
});

export const scheduleSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50),
  employeeName: z.string().trim().min(1, 'Employee name is required').max(255),
  date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  shiftType: shiftTypeSchema,
  startTime: z
    .string()
    .trim()
    .regex(timeRegex, 'Start time must be in HH:MM format'),
  endTime: z
    .string()
    .trim()
    .regex(timeRegex, 'End time must be in HH:MM format'),
  position: z.string().trim().min(1, 'Position is required').max(100),
  department: z.string().trim().min(1, 'Department is required').max(100),
  status: scheduleStatusSchema.default('scheduled'),
  notes: z.string().trim().optional().nullable(),
  source: scheduleSourceSchema.default('manual'),
  templateId: z.string().trim().max(50).optional().nullable(),
  recurrenceId: z.string().trim().max(50).optional().nullable(),
  isOverride: z.boolean().default(false),
});

export const scheduleUpdateSchema = scheduleSchema.partial();

export const bulkScheduleSchema = z.array(scheduleSchema).min(1);

export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;

export function validateSchedule(data: unknown) {
  return scheduleSchema.safeParse(data);
}

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
