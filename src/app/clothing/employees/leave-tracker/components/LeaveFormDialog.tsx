import React, { useMemo } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { PolishedModal } from '@/components/modals/PolishedModal';
import {
  polishedPrimaryButtonStyles,
  polishedReadOnlyFieldStyles,
} from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import type { LeaveRequest, LeaveType } from '../types';
import { toDate, toISODate } from '@/utils/date';

interface LeaveFormDialogProps {
  opened: boolean;
  onClose: () => void;
  editingRequest: LeaveRequest | null;
  leaveTypes: LeaveType[];
  employeeOptions: { value: string; label: string }[];
  isLoadingEmployees: boolean;
  formEmployeeName: string;
  setFormEmployeeName: (value: string) => void;
  formEmployeeId: string;
  setFormEmployeeId: (value: string) => void;
  formLeaveType: LeaveType | '';
  setFormLeaveType: (value: LeaveType | '') => void;
  formStartDate: string;
  setFormStartDate: (value: string) => void;
  formEndDate: string;
  setFormEndDate: (value: string) => void;
  formReason: string;
  setFormReason: (value: string) => void;
  formNotes: string;
  setFormNotes: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  isClearDisabled?: boolean;
  calculateDays: (
    startDate: string,
    endDate: string,
    employeeId?: string
  ) => number;
}

export function LeaveFormDialog({
  opened,
  onClose,
  editingRequest,
  leaveTypes,
  employeeOptions,
  isLoadingEmployees,
  formEmployeeName,
  setFormEmployeeName,
  formEmployeeId,
  setFormEmployeeId,
  formLeaveType,
  setFormLeaveType,
  formStartDate,
  setFormStartDate,
  formEndDate,
  setFormEndDate,
  formReason,
  setFormReason,
  formNotes,
  setFormNotes,
  onSave,
  onClear,
  isClearDisabled = false,
  calculateDays,
}: LeaveFormDialogProps) {
  const numberOfDays =
    formStartDate && formEndDate
      ? calculateDays(formStartDate, formEndDate, formEmployeeId)
      : 0;

  const employeeSelectData = useMemo(() => {
    if (
      formEmployeeId &&
      !employeeOptions.some((option) => option.value === formEmployeeId)
    ) {
      const fallbackLabel = formEmployeeName || formEmployeeId;
      return [
        ...employeeOptions,
        { value: formEmployeeId, label: fallbackLabel },
      ];
    }
    return employeeOptions;
  }, [employeeOptions, formEmployeeId, formEmployeeName]);

  const handleEmployeeSelect = (value: string | null) => {
    if (!value) {
      setFormEmployeeId('');
      setFormEmployeeName('');
      return;
    }

    const selected = employeeSelectData.find(
      (option) => option.value === value
    );
    setFormEmployeeId(value);
    setFormEmployeeName(selected ? selected.label : value);
  };
  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const employeeSelectPresentation = getSelectProps('employeeName');
  const leaveTypeSelectPresentation = getSelectProps('leaveType');
  const startDateField = getFieldProps('startDate');
  const endDateField = getFieldProps('endDate');
  const reasonField = getTextareaProps('reason');
  const notesField = getTextareaProps('notes');

  const isSubmitDisabled =
    !formEmployeeId ||
    !formEmployeeName ||
    !formLeaveType ||
    !formStartDate ||
    !formEndDate ||
    !formReason;

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      title={editingRequest ? 'Edit Leave Request' : 'Add Leave Request'}
      size="lg"
    >
      <Stack gap="lg">
        <Select
          label="Employee Name"
          required
          searchable
          clearable
          nothingFoundMessage={
            isLoadingEmployees ? 'Loading employees…' : 'No employees found'
          }
          data={employeeSelectData}
          value={formEmployeeId || null}
          onChange={handleEmployeeSelect}
          {...employeeSelectPresentation.handlers}
          disabled={isLoadingEmployees && employeeSelectData.length === 0}
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
          styles={employeeSelectPresentation.styles}
        />

        <TextInput
          label="Employee ID"
          required
          value={formEmployeeId}
          readOnly
          styles={polishedReadOnlyFieldStyles}
        />

        <Select
          label="Leave Type"
          required
          data={leaveTypes}
          value={formLeaveType}
          onChange={(value) => setFormLeaveType(value as LeaveType)}
          {...leaveTypeSelectPresentation.handlers}
          styles={leaveTypeSelectPresentation.styles}
        />

        <Group grow>
          <DateInput
            label="Start Date"
            valueFormat="MM/DD/YYYY"
            firstDayOfWeek={0}
            required
            value={toDate(formStartDate)}
            onChange={(value) => setFormStartDate(toISODate(value))}
            {...startDateField.handlers}
            styles={startDateField.styles}
          />

          <DateInput
            label="End Date"
            valueFormat="MM/DD/YYYY"
            firstDayOfWeek={0}
            required
            value={toDate(formEndDate)}
            onChange={(value) => setFormEndDate(toISODate(value))}
            {...endDateField.handlers}
            styles={endDateField.styles}
          />
        </Group>

        {formStartDate && formEndDate && (
          <TextInput
            label="Number of Days"
            value={`${numberOfDays} ${numberOfDays === 1 ? 'day' : 'days'}`}
            readOnly
            styles={polishedReadOnlyFieldStyles}
          />
        )}

        <Textarea
          label="Reason"
          required
          minRows={3}
          value={formReason}
          onChange={(e) => setFormReason(e.target.value)}
          {...reasonField.handlers}
          styles={reasonField.styles}
        />

        <Textarea
          label="Notes"
          minRows={2}
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          {...notesField.handlers}
          styles={notesField.styles}
        />

        <Group justify="flex-end" gap="sm" mt="sm">
          <Button
            radius="md"
            onClick={onClose}
            styles={polishedPrimaryButtonStyles}
          >
            Cancel
          </Button>
          <Button
            radius="md"
            onClick={onClear}
            disabled={isClearDisabled}
            styles={polishedPrimaryButtonStyles}
          >
            Clear
          </Button>
          <Button
            radius="md"
            onClick={onSave}
            disabled={isSubmitDisabled}
            styles={polishedPrimaryButtonStyles}
          >
            {editingRequest ? 'Update' : 'Submit'}
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
}
