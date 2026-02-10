import React, { memo } from 'react';
import {
  Stack,
  Group,
  Select,
  TextInput,
  Button,
  Divider,
  Text,
  Card,
  Pill,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import type { EmployeeSummary, Schedule, ShiftType } from '../types';
import { UniversalModal } from '@/components/modals/UniversalModal';

interface ScheduleModalProps {
  opened: boolean;
  onClose: () => void;
  editingSchedule: Schedule | null;
  employees: EmployeeSummary[];
  isLoadingEmployees: boolean;
  shiftConfig: Record<ShiftType, { start: string; end: string; label: string }>;
  dayLabels: string[];

  // Form state
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
  formBreak1Start: string;
  setFormBreak1Start: (value: string) => void;
  formBreak1End: string;
  setFormBreak1End: (value: string) => void;
  formLunchStart: string;
  setFormLunchStart: (value: string) => void;
  formLunchEnd: string;
  setFormLunchEnd: (value: string) => void;
  formBreak2Start: string;
  setFormBreak2Start: (value: string) => void;
  formBreak2End: string;
  setFormBreak2End: (value: string) => void;
  formPosition: string;
  setFormPosition: (value: string) => void;
  formDepartment: string;
  setFormDepartment: (value: string) => void;
  formNotes: string;
  setFormNotes: (value: string) => void;

  // Actions
  onSave: () => void;
  onReset: () => void;
}

export const ScheduleModal = memo(function ScheduleModal({
  opened,
  onClose,
  editingSchedule,
  employees,
  isLoadingEmployees,
  shiftConfig,
  dayLabels,
  // formEmployeeName is needed for setting but not reading
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  formBreak1Start,
  setFormBreak1Start,
  formBreak1End,
  setFormBreak1End,
  formLunchStart,
  setFormLunchStart,
  formLunchEnd,
  setFormLunchEnd,
  formBreak2Start,
  setFormBreak2Start,
  formBreak2End,
  setFormBreak2End,
  formPosition,
  setFormPosition,
  formDepartment,
  setFormDepartment,
  formNotes,
  setFormNotes,
  onSave,
  onReset,
}: ScheduleModalProps) {
  const handleEmployeeSelect = (employeeId: string | null) => {
    if (!employeeId) {
      return;
    }

    const employee = employees.find((emp) => emp.employeeId === employeeId);
    if (employee) {
      setFormEmployeeId(employee.employeeId);
      setFormEmployeeName(employee.name);
      setFormPosition(employee.position);
      setFormDepartment(employee.department);
    }
  };

  // Get day of week for selected date
  const selectedDayOfWeek = formDate
    ? dayLabels[new Date(formDate + 'T00:00:00').getDay()]
    : null;

  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title={editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
      size="xl"
    >
      <Stack gap="md">
        <Card withBorder radius="md">
          <Stack gap="sm">
            <Group grow>
              <Select
                label="Employee"
                placeholder="Select employee"
                data={employees.map((emp) => ({
                  value: emp.employeeId,
                  label: `${emp.name} (${emp.employeeId})`,
                }))}
                value={formEmployeeId || null}
                onChange={handleEmployeeSelect}
                searchable
                disabled={isLoadingEmployees}
                withAsterisk
              />
              <Select
                label="Shift"
                placeholder="Select shift type"
                data={Object.entries(shiftConfig).map(([value, config]) => ({
                  value,
                  label: config.label,
                }))}
                value={formShiftType}
                onChange={(value) =>
                  setFormShiftType((value as ShiftType) || '')
                }
                withAsterisk
              />
            </Group>

            <Group grow>
              <TextInput
                label="Position"
                value={formPosition}
                readOnly
                disabled
              />
              <TextInput
                label="Department"
                value={formDepartment}
                readOnly
                disabled
              />
            </Group>

            {selectedDayOfWeek && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Working day
                </Text>
                <Pill.Group>
                  <Pill
                    withRemoveButton={false}
                    style={{
                      backgroundColor: 'var(--mantine-color-blue-filled)',
                      color: 'var(--mantine-color-white)',
                      border: '1px solid var(--mantine-color-blue-filled)',
                    }}
                  >
                    {selectedDayOfWeek}
                  </Pill>
                </Pill.Group>
                <Text size="xs" c="dimmed">
                  Sundays are excluded unless you select them explicitly.
                </Text>
              </Stack>
            )}

            <Group grow>
              <DateInput
                label="Start date"
                value={parseDateValue(formDate)}
                onChange={(value) => setFormDate(formatDateForInput(value))}
                placeholder="Select date"
                withAsterisk
                clearable
                {...COMMON_DATE_INPUT_PROPS}
              />
              <Group grow>
                <TextInput
                  label="Start Time"
                  type="time"
                  value={formStartTime}
                  onChange={(event) => setFormStartTime(event.target.value)}
                  placeholder="HH:MM"
                  withAsterisk
                />
                <TextInput
                  label="End Time"
                  type="time"
                  value={formEndTime}
                  onChange={(event) => setFormEndTime(event.target.value)}
                  placeholder="HH:MM"
                  withAsterisk
                />
              </Group>
            </Group>

            <Divider label="Break Schedules" labelPosition="left" my="sm" />

            <Stack gap="sm">
              <Text size="sm" fw={500} c="dimmed">
                First Break (15 minutes)
              </Text>
              <Group grow>
                <TextInput
                  label="Start Time"
                  type="time"
                  value={formBreak1Start}
                  onChange={(event) => setFormBreak1Start(event.target.value)}
                  placeholder="HH:MM"
                />
                <TextInput
                  label="End Time"
                  type="time"
                  value={formBreak1End}
                  onChange={(event) => setFormBreak1End(event.target.value)}
                  placeholder="HH:MM"
                />
              </Group>

              <Text size="sm" fw={500} c="dimmed" mt="xs">
                Lunch Break (1 hour)
              </Text>
              <Group grow>
                <TextInput
                  label="Start Time"
                  type="time"
                  value={formLunchStart}
                  onChange={(event) => setFormLunchStart(event.target.value)}
                  placeholder="HH:MM"
                />
                <TextInput
                  label="End Time"
                  type="time"
                  value={formLunchEnd}
                  onChange={(event) => setFormLunchEnd(event.target.value)}
                  placeholder="HH:MM"
                />
              </Group>

              <Text size="sm" fw={500} c="dimmed" mt="xs">
                Second Break (15 minutes)
              </Text>
              <Group grow>
                <TextInput
                  label="Start Time"
                  type="time"
                  value={formBreak2Start}
                  onChange={(event) => setFormBreak2Start(event.target.value)}
                  placeholder="HH:MM"
                />
                <TextInput
                  label="End Time"
                  type="time"
                  value={formBreak2End}
                  onChange={(event) => setFormBreak2End(event.target.value)}
                  placeholder="HH:MM"
                />
              </Group>
            </Stack>

            <Divider my="sm" />

            <Textarea
              label="Notes"
              value={formNotes}
              onChange={(event) => setFormNotes(event.target.value)}
              minRows={2}
            />

            <Group justify="space-between" mt="sm">
              <Button variant="default" onClick={onReset}>
                Reset
              </Button>
              <Button onClick={onSave}>
                {editingSchedule ? 'Save Changes' : 'Save Rule'}
              </Button>
            </Group>
          </Stack>
        </Card>

        {!editingSchedule && (
          <>
            <Divider label="Existing rules" labelPosition="left" />
            <Text size="sm" c="dimmed">
              No recurring rules yet.
            </Text>
          </>
        )}
      </Stack>
    </UniversalModal>
  );
});
