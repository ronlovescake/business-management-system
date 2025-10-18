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
  onClear: () => void;
  isClearDisabled?: boolean;
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
  onClear,
  isClearDisabled = false,
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

  const baseLabelStyles = useMemo(
    () => ({
      fontWeight: 600,
      fontSize: '0.85rem',
      color: '#475467',
      marginBottom: 6,
    }),
    []
  );

  const baseInputStyles = useMemo(
    () => ({
      backgroundColor: '#f5f5f5',
      border: '1px solid #e5e7ed',
      borderRadius: 12,
      padding: '0.65rem 0.95rem',
      fontSize: '0.95rem',
      color: '#1f2937',
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      minHeight: 48,
      '&:focus-within': {
        borderColor: '#12b76a',
        boxShadow: '0 0 0 3px rgba(18, 183, 106, 0.12)',
      },
    }),
    []
  );

  const sharedFieldStyles = useMemo(
    () => ({
      label: baseLabelStyles,
      input: baseInputStyles,
    }),
    [baseInputStyles, baseLabelStyles]
  );

  const readOnlyFieldStyles = useMemo(
    () => ({
      label: baseLabelStyles,
      input: {
        ...baseInputStyles,
        backgroundColor: '#eef1f5',
        color: '#667085',
      },
    }),
    [baseInputStyles, baseLabelStyles]
  );

  const textareaFieldStyles = useMemo(
    () => ({
      label: baseLabelStyles,
      input: {
        ...baseInputStyles,
        minHeight: 108,
        resize: 'vertical' as const,
      },
    }),
    [baseInputStyles, baseLabelStyles]
  );

  const selectStyles = useMemo(
    () => ({
      label: baseLabelStyles,
      input: baseInputStyles,
      dropdown: {
        borderRadius: 16,
        border: '1px solid #e5e7ed',
        boxShadow: '0 18px 40px rgba(16, 24, 40, 0.08)',
      },
      option: {
        borderRadius: 10,
        fontSize: '0.95rem',
        padding: '0.5rem 0.75rem',
      },
    }),
    [baseInputStyles, baseLabelStyles]
  );

  const primaryButtonStyles = useMemo(
    () => ({
      root: {
        backgroundColor: '#4caf50',
        color: '#ffffff',
        borderColor: '#4caf50',
        '&:hover': {
          backgroundColor: '#4f8a45',
        },
        '&:disabled': {
          backgroundColor: '#bfddba',
          borderColor: '#bfddba',
          color: '#ffffff',
        },
      },
    }),
    []
  );

  const isSubmitDisabled =
    !formEmployeeId ||
    !formEmployeeName ||
    !formLeaveType ||
    !formStartDate ||
    !formEndDate ||
    !formReason;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingRequest ? 'Edit Leave Request' : 'Add Leave Request'}
      size="lg"
      padding="xl"
      radius="xl"
      centered
      overlayProps={{ color: '#0f172a', opacity: 0.18, blur: 6 }}
      styles={{
        content: {
          borderRadius: '28px',
          border: '1px solid #ebedf2',
          boxShadow: '0 32px 60px rgba(15, 23, 42, 0.18)',
        },
        header: {
          padding: '1.5rem 1.75rem 0.75rem',
        },
        title: {
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#101828',
        },
        body: {
          padding: '0 1.75rem 1.85rem',
        },
      }}
    >
      <Stack gap="lg">
        <Select
          label="Employee Name"
          placeholder="Select employee"
          required
          searchable
          clearable
          nothingFoundMessage={
            isLoadingEmployees ? 'Loading employees…' : 'No employees found'
          }
          data={employeeSelectData}
          value={formEmployeeId || null}
          onChange={handleEmployeeSelect}
          disabled={isLoadingEmployees && employeeSelectData.length === 0}
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
          styles={selectStyles}
        />

        <TextInput
          label="Employee ID"
          placeholder="Auto-populated"
          required
          value={formEmployeeId}
          readOnly
          styles={readOnlyFieldStyles}
        />

        <Select
          label="Leave Type"
          placeholder="Select leave type"
          required
          data={leaveTypes}
          value={formLeaveType}
          onChange={(value) => setFormLeaveType(value as LeaveType)}
          styles={selectStyles}
        />

        <Group grow>
          <TextInput
            label="Start Date"
            type="date"
            required
            value={formStartDate}
            onChange={(e) => setFormStartDate(e.target.value)}
            styles={sharedFieldStyles}
          />

          <TextInput
            label="End Date"
            type="date"
            required
            value={formEndDate}
            onChange={(e) => setFormEndDate(e.target.value)}
            styles={sharedFieldStyles}
          />
        </Group>

        {formStartDate && formEndDate && (
          <TextInput
            label="Number of Days"
            value={`${numberOfDays} ${numberOfDays === 1 ? 'day' : 'days'}`}
            readOnly
            styles={readOnlyFieldStyles}
          />
        )}

        <Textarea
          label="Reason"
          placeholder="Enter reason for leave"
          required
          minRows={3}
          value={formReason}
          onChange={(e) => setFormReason(e.target.value)}
          styles={textareaFieldStyles}
        />

        <Textarea
          label="Notes"
          placeholder="Additional notes (optional)"
          minRows={2}
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          styles={textareaFieldStyles}
        />

        <Group justify="flex-end" gap="sm" mt="sm">
          <Button radius="md" onClick={onClose} styles={primaryButtonStyles}>
            Cancel
          </Button>
          <Button
            radius="md"
            onClick={onClear}
            disabled={isClearDisabled}
            styles={primaryButtonStyles}
          >
            Clear
          </Button>
          <Button
            radius="md"
            onClick={onSave}
            disabled={isSubmitDisabled}
            styles={primaryButtonStyles}
          >
            {editingRequest ? 'Update' : 'Submit'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
