import React, { useMemo } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
} from '@mantine/core';
import type { LeaveRequest, LeaveType } from '../types';

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
  calculateDays: (startDate: string, endDate: string) => number;
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
  calculateDays,
}: LeaveFormDialogProps) {
  const numberOfDays =
    formStartDate && formEndDate
      ? calculateDays(formStartDate, formEndDate)
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingRequest ? 'Edit Leave Request' : 'Add Leave Request'}
      size="lg"
      centered
    >
      <Stack gap="md">
        <Select
          label="Employee Name"
          placeholder="Select employee"
          required
          searchable
          nothingFoundMessage={
            isLoadingEmployees ? 'Loading employees...' : 'No employees found'
          }
          data={employeeSelectData}
          value={formEmployeeId || null}
          onChange={handleEmployeeSelect}
          disabled={isLoadingEmployees && employeeSelectData.length === 0}
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 400 }}
        />

        <TextInput
          label="Employee ID"
          placeholder="Auto-populated"
          required
          value={formEmployeeId}
          readOnly
          disabled
        />

        <Select
          label="Leave Type"
          placeholder="Select leave type"
          required
          data={leaveTypes}
          value={formLeaveType}
          onChange={(value) => setFormLeaveType(value as LeaveType)}
        />

        <Group grow>
          <TextInput
            label="Start Date"
            type="date"
            required
            value={formStartDate}
            onChange={(e) => setFormStartDate(e.target.value)}
          />

          <TextInput
            label="End Date"
            type="date"
            required
            value={formEndDate}
            onChange={(e) => setFormEndDate(e.target.value)}
          />
        </Group>

        {formStartDate && formEndDate && (
          <TextInput
            label="Number of Days"
            value={`${numberOfDays} ${numberOfDays === 1 ? 'day' : 'days'}`}
            readOnly
            disabled
          />
        )}

        <Textarea
          label="Reason"
          placeholder="Enter reason for leave"
          required
          minRows={3}
          value={formReason}
          onChange={(e) => setFormReason(e.target.value)}
        />

        <Textarea
          label="Notes"
          placeholder="Additional notes (optional)"
          minRows={2}
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {editingRequest ? 'Update' : 'Submit'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
