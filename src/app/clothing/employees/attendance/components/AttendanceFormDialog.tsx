import React from 'react';
import {
  Modal,
  Stack,
  Group,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Button,
} from '@mantine/core';
import type { AttendanceFormValues, AttendanceStatus } from '../types';

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

export function AttendanceFormDialog({
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Record Attendance"
      size="lg"
      centered
    >
      <Stack gap="md">
        <Group grow>
          <TextInput
            label="Employee Name"
            placeholder="Enter employee name"
            required
            value={formValues.employeeName}
            onChange={(event) =>
              onChange('employeeName', event.currentTarget.value)
            }
          />

          <TextInput
            label="Employee ID"
            placeholder="Enter employee ID"
            required
            value={formValues.employeeId}
            onChange={(event) =>
              onChange('employeeId', event.currentTarget.value)
            }
          />
        </Group>

        <Group grow>
          <TextInput
            label="Department"
            placeholder="e.g., Warehouse POC"
            value={formValues.department}
            onChange={(event) =>
              onChange('department', event.currentTarget.value)
            }
          />

          <TextInput
            label="Position"
            placeholder="e.g., Stay-in Employee"
            value={formValues.position}
            onChange={(event) =>
              onChange('position', event.currentTarget.value)
            }
          />
        </Group>

        <Group grow>
          <TextInput
            label="Date"
            type="date"
            required
            value={formValues.date}
            onChange={(event) => onChange('date', event.currentTarget.value)}
          />

          <Select
            label="Status"
            placeholder="Select status"
            data={statusOptions}
            value={formValues.status}
            onChange={handleStatusChange}
            required
          />
        </Group>

        <Group grow>
          <TextInput
            label="Time In"
            type="time"
            value={formValues.timeIn}
            onChange={(event) => onChange('timeIn', event.currentTarget.value)}
          />

          <TextInput
            label="Time Out"
            type="time"
            value={formValues.timeOut}
            onChange={(event) => onChange('timeOut', event.currentTarget.value)}
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
          />

          <TextInput
            label="Break 1 End"
            type="time"
            value={formValues.break1End}
            onChange={(event) =>
              onChange('break1End', event.currentTarget.value)
            }
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
          />

          <TextInput
            label="Lunch End"
            type="time"
            value={formValues.lunchEnd}
            onChange={(event) =>
              onChange('lunchEnd', event.currentTarget.value)
            }
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
          />

          <TextInput
            label="Break 2 End"
            type="time"
            value={formValues.break2End}
            onChange={(event) =>
              onChange('break2End', event.currentTarget.value)
            }
          />
        </Group>

        <NumberInput
          label="Total Hours"
          placeholder="Auto-calculated from Time In/Out"
          min={0}
          decimalScale={2}
          step={0.25}
          hideControls
          value={formValues.totalHours}
          onChange={(value) => onChange('totalHours', value?.toString() || '')}
          description="Automatically calculated when both Time In and Time Out are provided."
        />

        <Textarea
          label="Details"
          placeholder="Add shift notes or context"
          minRows={2}
          value={formValues.details}
          onChange={(event) => onChange('details', event.currentTarget.value)}
        />

        <Textarea
          label="Internal Notes"
          placeholder="Additional notes (optional)"
          minRows={2}
          value={formValues.notes}
          onChange={(event) => onChange('notes', event.currentTarget.value)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>Record Attendance</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
