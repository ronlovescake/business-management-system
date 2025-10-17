import {
  Modal,
  Stack,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
} from '@mantine/core';
import type { EmployeeSummary, ShiftType } from '../types';

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
  employees: EmployeeSummary[];
  isLoadingEmployees: boolean;
  shiftConfig: Record<ShiftType, { start: string; end: string; label: string }>;
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
  formEmployeeName: _formEmployeeName,
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
  employees,
  isLoadingEmployees,
  shiftConfig,
}: ScheduleFormDialogProps) {
  const applyShiftDefaults = (shiftType: ShiftType | '') => {
    if (!shiftType) {
      return;
    }

    const defaults = shiftConfig[shiftType];
    if (!defaults) {
      return;
    }

    setFormShiftType(shiftType);
    setFormStartTime(defaults.start);
    setFormEndTime(defaults.end);
  };

  // Handle employee selection
  const handleEmployeeSelect = (value: string | null) => {
    if (!value) {
      return;
    }

    const selectedEmployee = employees.find((emp) => emp.employeeId === value);
    if (selectedEmployee) {
      setFormEmployeeName(selectedEmployee.name);
      setFormEmployeeId(selectedEmployee.employeeId);
      setFormPosition(selectedEmployee.position);
      setFormDepartment(selectedEmployee.department);

      if (selectedEmployee.employeeType === 'stay-in') {
        applyShiftDefaults('full-day');
      }
    }
  };

  // Auto-set times based on shift type
  const handleShiftTypeChange = (value: string | null) => {
    applyShiftDefaults((value as ShiftType | '') || '');
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Schedule' : 'Add Schedule'}
      size="lg"
    >
      <Stack>
        <Select
          label="Employee Name"
          placeholder="Select employee"
          data={employees.map((emp) => ({
            value: emp.employeeId,
            label: `${emp.name} (${emp.employeeId})`,
          }))}
          value={formEmployeeId}
          onChange={handleEmployeeSelect}
          searchable
          required
          disabled={isLoadingEmployees || isEditing}
          description={
            isEditing ? 'Cannot change employee when editing' : undefined
          }
        />

        <Group grow>
          <TextInput
            label="Employee ID"
            value={formEmployeeId}
            readOnly
            disabled
            styles={{
              input: {
                backgroundColor: '#f8f9fa',
                cursor: 'not-allowed',
              },
            }}
          />
          <TextInput
            label="Position"
            value={formPosition}
            readOnly
            disabled
            styles={{
              input: {
                backgroundColor: '#f8f9fa',
                cursor: 'not-allowed',
              },
            }}
          />
        </Group>

        <TextInput
          label="Department"
          value={formDepartment}
          readOnly
          disabled
          styles={{
            input: {
              backgroundColor: '#f8f9fa',
              cursor: 'not-allowed',
            },
          }}
        />

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
          data={Object.entries(shiftConfig).map(([value, config]) => ({
            value,
            label: config.label,
          }))}
          value={formShiftType}
          onChange={handleShiftTypeChange}
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
