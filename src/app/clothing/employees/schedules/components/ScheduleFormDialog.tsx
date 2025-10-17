import {
  Modal,
  Stack,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import type { ShiftType } from '../types';

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  status: string;
}

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
}: ScheduleFormDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  // Fetch employees from the team/employees API
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const response = await fetch('/api/employees?status=active');
        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }
        const data = await response.json();

        // Transform to match our Employee interface
        const transformedData = data.map(
          (emp: {
            id: number;
            employeeId: string;
            name: string;
            position: string;
            department: string;
            status: string;
          }) => ({
            id: emp.id.toString(),
            employeeId: emp.employeeId,
            name: emp.name,
            position: emp.position,
            department: emp.department,
            status: emp.status,
          })
        );

        setEmployees(transformedData);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

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
    }
  };

  // Auto-set times based on shift type
  const handleShiftTypeChange = (value: string | null) => {
    setFormShiftType(value as ShiftType | '');

    // Auto-populate start and end times based on shift type
    switch (value) {
      case 'morning':
        setFormStartTime('08:00');
        setFormEndTime('17:00');
        break;
      case 'afternoon':
        setFormStartTime('15:00');
        setFormEndTime('00:00');
        break;
      case 'night':
        setFormStartTime('00:00');
        setFormEndTime('09:00');
        break;
      case 'full-day':
        setFormStartTime('04:00');
        setFormEndTime('17:00');
        break;
      default:
        break;
    }
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
          data={[
            { value: 'morning', label: 'Morning (8:00 AM - 5:00 PM)' },
            { value: 'afternoon', label: 'Afternoon (3:00 PM - 12:00 AM)' },
            { value: 'night', label: 'Night (12:00 AM - 9:00 AM)' },
            { value: 'full-day', label: 'Full Day (4:00 AM - 5:00 PM)' },
          ]}
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
