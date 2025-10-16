import {
  Modal,
  Stack,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
} from '@mantine/core';
import type { ShiftType } from '../types';

interface ScheduleFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  formEmployeeName: string;
  setFormEmployeeName: (value: string) => void;
  formEmployeeId: string;
  setFormEmployeeId: (value: string) => void;
  formDate: string;
  setFormDate: (value: string) => void;
  formShiftType: ShiftType | '';
  setFormShiftType: (value: ShiftType | '') => void;
  formStartTime: string;
  setFormStartTime: (value: string) => void;
  formEndTime: string;
  setFormEndTime: (value: string) => void;
  formPosition: string;
  setFormPosition: (value: string) => void;
  formDepartment: string;
  setFormDepartment: (value: string) => void;
  formNotes: string;
  setFormNotes: (value: string) => void;
  onSave: () => void;
}

/**
 * ScheduleFormDialog Component
 *
 * Modal dialog for adding/editing schedules
 */
export function ScheduleFormDialog({
  isOpen,
  onClose,
  isEditing,
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
  onSave,
}: ScheduleFormDialogProps) {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Schedule' : 'Add Schedule'}
      size="lg"
    >
      <Stack>
        <Group grow>
          <TextInput
            label="Employee Name"
            placeholder="John Doe"
            value={formEmployeeName}
            onChange={(e) => setFormEmployeeName(e.target.value)}
            required
          />
          <TextInput
            label="Employee ID"
            placeholder="EMP-0001"
            value={formEmployeeId}
            onChange={(e) => setFormEmployeeId(e.target.value)}
            required
          />
        </Group>

        <TextInput
          label="Date"
          type="date"
          value={formDate}
          onChange={(e) => setFormDate(e.target.value)}
          required
        />

        <Select
          label="Shift Type"
          placeholder="Select shift type"
          data={[
            { value: 'morning', label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
            { value: 'night', label: 'Night' },
            { value: 'full-day', label: 'Full Day' },
          ]}
          value={formShiftType}
          onChange={(value) => setFormShiftType(value as ShiftType)}
          required
        />

        <Group grow>
          <TextInput
            label="Start Time"
            type="time"
            value={formStartTime}
            onChange={(e) => setFormStartTime(e.target.value)}
            required
          />
          <TextInput
            label="End Time"
            type="time"
            value={formEndTime}
            onChange={(e) => setFormEndTime(e.target.value)}
            required
          />
        </Group>

        <Group grow>
          <TextInput
            label="Position"
            placeholder="Sewing Operator"
            value={formPosition}
            onChange={(e) => setFormPosition(e.target.value)}
            required
          />
          <TextInput
            label="Department"
            placeholder="Production"
            value={formDepartment}
            onChange={(e) => setFormDepartment(e.target.value)}
            required
          />
        </Group>

        <Textarea
          label="Notes"
          placeholder="Additional notes (optional)"
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          rows={3}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            {isEditing ? 'Save Changes' : 'Add Schedule'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
