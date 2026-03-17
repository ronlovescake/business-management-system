import { useCallback, useState } from 'react';
import { getCurrentDateISO } from '@/utils/date';
import type { Schedule, ShiftType } from '../types';

type ScheduleFormValues = {
  formEmployeeName: string;
  formEmployeeId: string;
  formDate: string;
  formShiftType: ShiftType | '';
  formStartTime: string;
  formEndTime: string;
  formPosition: string;
  formDepartment: string;
  formNotes: string;
};

const buildEmptyFormValues = (): ScheduleFormValues => ({
  formEmployeeName: '',
  formEmployeeId: '',
  formDate: getCurrentDateISO(),
  formShiftType: '',
  formStartTime: '',
  formEndTime: '',
  formPosition: '',
  formDepartment: '',
  formNotes: '',
});

const buildScheduleFormValues = (schedule: Schedule): ScheduleFormValues => ({
  formEmployeeName: schedule.employeeName,
  formEmployeeId: schedule.employeeId,
  formDate: schedule.date,
  formShiftType: schedule.shiftType,
  formStartTime: schedule.startTime,
  formEndTime: schedule.endTime,
  formPosition: schedule.position,
  formDepartment: schedule.department,
  formNotes: schedule.notes || '',
});

export function useScheduleFormState() {
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formShiftType, setFormShiftType] = useState<ShiftType | ''>('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const applyFormValues = useCallback((values: ScheduleFormValues) => {
    setFormEmployeeName(values.formEmployeeName);
    setFormEmployeeId(values.formEmployeeId);
    setFormDate(values.formDate);
    setFormShiftType(values.formShiftType);
    setFormStartTime(values.formStartTime);
    setFormEndTime(values.formEndTime);
    setFormPosition(values.formPosition);
    setFormDepartment(values.formDepartment);
    setFormNotes(values.formNotes);
  }, []);

  const resetFormForCreate = useCallback(() => {
    applyFormValues(buildEmptyFormValues());
  }, [applyFormValues]);

  const populateFormFromSchedule = useCallback(
    (schedule: Schedule) => {
      applyFormValues(buildScheduleFormValues(schedule));
    },
    [applyFormValues]
  );

  return {
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formDate,
    setFormDate,
    formShiftType,
    setFormShiftType,
    formStartTime,
    setFormStartTime,
    formEndTime,
    setFormEndTime,
    formPosition,
    setFormPosition,
    formDepartment,
    setFormDepartment,
    formNotes,
    setFormNotes,
    resetFormForCreate,
    populateFormFromSchedule,
  };
}
