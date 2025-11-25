import React, { memo } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Button,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconClipboardCheck } from '@tabler/icons-react';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import type { AttendanceFormValues, AttendanceStatus } from '../types';
import { toDate, toISODate } from '@/utils/date';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

interface AttendanceFormDialogProps {
  opened: boolean;
  onClose: () => void;
  formValues: AttendanceFormValues;
  onChange: <K extends keyof AttendanceFormValues>(
    field: K,
    value: AttendanceFormValues[K]
  ) => void;
  onSubmit: () => void;
}

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'on-leave', label: 'On Leave' },
];

export const AttendanceFormDialog = memo(function AttendanceFormDialog({
  opened,
  onClose,
  formValues,
  onChange,
  onSubmit,
}: AttendanceFormDialogProps) {
  const handleStatusChange = (value: string | null) => {
    const status = (value as AttendanceStatus) || 'present';
    onChange('status', status);
  };

  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const employeeNameField = getFieldProps('employeeName');
  const employeeIdField = getFieldProps('employeeId');
  const departmentField = getFieldProps('department');
  const positionField = getFieldProps('position');
  const dateField = getFieldProps('date');
  const timeInField = getFieldProps('timeIn');
  const timeOutField = getFieldProps('timeOut');
  const break1StartField = getFieldProps('break1Start');
  const break1EndField = getFieldProps('break1End');
  const lunchStartField = getFieldProps('lunchStart');
  const lunchEndField = getFieldProps('lunchEnd');
  const break2StartField = getFieldProps('break2Start');
  const break2EndField = getFieldProps('break2End');
  const totalHoursField = getFieldProps('totalHours');
  const statusSelect = getSelectProps('status');
  const detailsField = getTextareaProps('details');
  const notesField = getTextareaProps('notes');

  const buildTimeStyles = (baseStyles: typeof timeInField.styles) => ({
    ...baseStyles,
    input: {
      ...baseStyles.input,
      '&::-webkit-datetime-edit': {
        color: '#1f2937',
      },
    },
  });

  const timeInStyles = buildTimeStyles(timeInField.styles);
  const timeOutStyles = buildTimeStyles(timeOutField.styles);
  const break1StartStyles = buildTimeStyles(break1StartField.styles);
  const break1EndStyles = buildTimeStyles(break1EndField.styles);
  const lunchStartStyles = buildTimeStyles(lunchStartField.styles);
  const lunchEndStyles = buildTimeStyles(lunchEndField.styles);
  const break2StartStyles = buildTimeStyles(break2StartField.styles);
  const break2EndStyles = buildTimeStyles(break2EndField.styles);

  const modalTitle = (
    <Group gap="sm" align="center">
      <IconClipboardCheck size={26} color="#65ab58" />
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          Record Attendance
        </Text>
        <Text fz="sm" c="#667085">
          Capture today&apos;s attendance details for this employee
        </Text>
      </Stack>
    </Group>
  );

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      size="lg"
    >
      <Stack gap="md">
        <Group grow>
          <TextInput
            label="Employee Name"
            required
            value={formValues.employeeName}
            onChange={(event) =>
              onChange('employeeName', event.currentTarget.value)
            }
            {...employeeNameField.handlers}
            styles={employeeNameField.styles}
          />

          <TextInput
            label="Employee ID"
            required
            value={formValues.employeeId}
            onChange={(event) =>
              onChange('employeeId', event.currentTarget.value)
            }
            {...employeeIdField.handlers}
            styles={employeeIdField.styles}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Department"
            value={formValues.department}
            onChange={(event) =>
              onChange('department', event.currentTarget.value)
            }
            {...departmentField.handlers}
            styles={departmentField.styles}
          />

          <TextInput
            label="Position"
            value={formValues.position}
            onChange={(event) =>
              onChange('position', event.currentTarget.value)
            }
            {...positionField.handlers}
            styles={positionField.styles}
          />
        </Group>

        <Group grow>
          <DateInput
            label="Date"
            valueFormat="MM/DD/YYYY"
            {...COMMON_DATE_INPUT_PROPS}
            required
            value={toDate(formValues.date)}
            onChange={(value) => onChange('date', toISODate(value))}
            {...dateField.handlers}
            styles={dateField.styles}
          />

          <Select
            label="Status"
            data={statusOptions}
            value={formValues.status}
            onChange={handleStatusChange}
            required
            {...statusSelect.handlers}
            styles={statusSelect.styles}
            withCheckIcon={false}
            comboboxProps={{ withinPortal: true, zIndex: 500 }}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Time In"
            type="time"
            value={formValues.timeIn}
            onChange={(event) => onChange('timeIn', event.currentTarget.value)}
            {...timeInField.handlers}
            styles={timeInStyles}
          />

          <TextInput
            label="Time Out"
            type="time"
            value={formValues.timeOut}
            onChange={(event) => onChange('timeOut', event.currentTarget.value)}
            {...timeOutField.handlers}
            styles={timeOutStyles}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Break 1 Start"
            type="time"
            value={formValues.break1Start}
            onChange={(event) =>
              onChange('break1Start', event.currentTarget.value)
            }
            {...break1StartField.handlers}
            styles={break1StartStyles}
          />

          <TextInput
            label="Break 1 End"
            type="time"
            value={formValues.break1End}
            onChange={(event) =>
              onChange('break1End', event.currentTarget.value)
            }
            {...break1EndField.handlers}
            styles={break1EndStyles}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Lunch Start"
            type="time"
            value={formValues.lunchStart}
            onChange={(event) =>
              onChange('lunchStart', event.currentTarget.value)
            }
            {...lunchStartField.handlers}
            styles={lunchStartStyles}
          />

          <TextInput
            label="Lunch End"
            type="time"
            value={formValues.lunchEnd}
            onChange={(event) =>
              onChange('lunchEnd', event.currentTarget.value)
            }
            {...lunchEndField.handlers}
            styles={lunchEndStyles}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Break 2 Start"
            type="time"
            value={formValues.break2Start}
            onChange={(event) =>
              onChange('break2Start', event.currentTarget.value)
            }
            {...break2StartField.handlers}
            styles={break2StartStyles}
          />

          <TextInput
            label="Break 2 End"
            type="time"
            value={formValues.break2End}
            onChange={(event) =>
              onChange('break2End', event.currentTarget.value)
            }
            {...break2EndField.handlers}
            styles={break2EndStyles}
          />
        </Group>

        <NumberInput
          label="Total Hours"
          min={0}
          decimalScale={2}
          step={0.25}
          hideControls
          value={formValues.totalHours}
          onChange={(value) => onChange('totalHours', value?.toString() || '')}
          description="Automatically calculated when both Time In and Time Out are provided."
          {...totalHoursField.handlers}
          styles={totalHoursField.styles}
        />

        <Textarea
          label="Details"
          minRows={2}
          value={formValues.details}
          onChange={(event) => onChange('details', event.currentTarget.value)}
          {...detailsField.handlers}
          styles={detailsField.styles}
        />

        <Textarea
          label="Internal Notes"
          minRows={2}
          value={formValues.notes}
          onChange={(event) => onChange('notes', event.currentTarget.value)}
          {...notesField.handlers}
          styles={notesField.styles}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" radius="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            radius="md"
            onClick={onSubmit}
            styles={polishedPrimaryButtonStyles}
          >
            Record Attendance
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
});
