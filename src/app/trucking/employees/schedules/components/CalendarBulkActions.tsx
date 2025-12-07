import { useEffect, useMemo, useState, memo } from 'react';
import {
  Button,
  Card,
  Group,
  Modal,
  Pill,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import Swal from 'sweetalert2';
import type { EmployeeSummary, RecurringRule, ShiftType } from '../types';

interface CalendarBulkActionsProps {
  recurringRules: RecurringRule[];
  onSaveRule: (
    rule: Omit<RecurringRule, 'id'> & { id?: string }
  ) => string | Promise<string>;
  onDeleteRule: (id: string) => void;
  employees: EmployeeSummary[];
  isLoadingEmployees: boolean;
  shiftConfig: Record<ShiftType, { start: string; end: string; label: string }>;
  dayLabels: string[];
  openRecurringRulesModal?: boolean;
  onRecurringRulesModalChange?: (isOpen: boolean) => void;
}

interface RecurringRuleDraft extends Omit<RecurringRule, 'id'> {
  id?: string;
}

export const CalendarBulkActions = memo(function CalendarBulkActions({
  recurringRules: _recurringRules,
  onSaveRule,
  onDeleteRule: _onDeleteRule,
  employees,
  isLoadingEmployees,
  shiftConfig,
  dayLabels,
  openRecurringRulesModal = false,
  onRecurringRulesModalChange,
}: CalendarBulkActionsProps) {
  const [ruleModalOpen, setRuleModalOpen] = useState(openRecurringRulesModal);
  const [ruleDraft, setRuleDraft] = useState<RecurringRuleDraft>({
    employeeId: '',
    employeeName: '',
    position: '',
    department: '',
    shiftType: 'morning',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    startDate: '',
    endDate: undefined,
    break1: '',
    lunch: '',
    break2: '',
    notes: '',
    isStayIn: false,
  });

  // Sync with external control of recurring rules modal
  useEffect(() => {
    if (openRecurringRulesModal) {
      setRuleModalOpen(true);
    }
  }, [openRecurringRulesModal]);

  // Notify parent when recurring rules modal changes
  useEffect(() => {
    onRecurringRulesModalChange?.(ruleModalOpen);
  }, [ruleModalOpen, onRecurringRulesModalChange]);

  const dayOptions = useMemo(
    () =>
      dayLabels.map((label, index) => ({
        value: index.toString(),
        label,
      })),
    [dayLabels]
  );

  const handleEmployeeForRule = (employeeId: string) => {
    const employee = employees.find((emp) => emp.employeeId === employeeId);
    if (!employee) {
      return;
    }

    const stayIn = employee.employeeType === 'stay-in';
    setRuleDraft((prev) => ({
      ...prev,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      position: employee.position,
      department: employee.department,
      shiftType: stayIn ? 'full-day' : prev.shiftType,
      isStayIn: stayIn,
    }));
  };

  const handleSaveRule = async () => {
    if (
      !ruleDraft.employeeId ||
      !ruleDraft.startDate ||
      ruleDraft.daysOfWeek.length === 0
    ) {
      await Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Employee, start date, and at least one work day are required',
        confirmButtonColor: '#228be6',
        allowOutsideClick: false,
      });
      return;
    }

    // Show confirmation dialog before saving
    const result = await Swal.fire({
      icon: 'question',
      title: 'Save Schedules?',
      text: `This will create schedules for ${ruleDraft.employeeName} starting from ${ruleDraft.startDate}`,
      showCancelButton: true,
      confirmButtonColor: '#228be6',
      cancelButtonColor: '#868e96',
      confirmButtonText: 'Yes, save schedules',
      cancelButtonText: 'Cancel',
      allowOutsideClick: false,
    });

    if (!result.isConfirmed) {
      return;
    }

    const normalizedRule: RecurringRuleDraft = {
      ...ruleDraft,
      daysOfWeek: Array.from(new Set(ruleDraft.daysOfWeek)).sort(
        (a, b) => a - b
      ),
    };

    try {
      await onSaveRule(normalizedRule);
      setRuleDraft({
        employeeId: '',
        employeeName: '',
        position: '',
        department: '',
        shiftType: 'morning',
        daysOfWeek: [1, 2, 3, 4, 5, 6],
        startDate: '',
        endDate: undefined,
        break1: '',
        lunch: '',
        break2: '',
        notes: '',
        isStayIn: false,
        id: undefined,
      });

      // Close the modal
      setRuleModalOpen(false);

      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Schedules saved successfully',
        confirmButtonColor: '#228be6',
        confirmButtonText: 'OK',
        allowOutsideClick: false,
      });
    } catch (error) {
      // Error is already handled by the hook with SweetAlert
      return;
    }
  };

  return (
    <>
      <Modal
        opened={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Add Schedule"
        size="xl"
        centered
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
                  value={ruleDraft.employeeId || null}
                  onChange={(value) => value && handleEmployeeForRule(value)}
                  searchable
                  disabled={isLoadingEmployees}
                  withAsterisk
                />
                <Select
                  label="Shift"
                  data={Object.entries(shiftConfig).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                  value={ruleDraft.shiftType}
                  onChange={(value) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      shiftType: (value as ShiftType) || prev.shiftType,
                    }))
                  }
                  disabled={ruleDraft.isStayIn}
                  withAsterisk
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Break 1"
                  type="time"
                  value={ruleDraft.break1 || ''}
                  onChange={(event) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      break1: event.target.value,
                    }))
                  }
                  placeholder="HH:MM"
                />
                <TextInput
                  label="Lunch"
                  type="time"
                  value={ruleDraft.lunch || ''}
                  onChange={(event) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      lunch: event.target.value,
                    }))
                  }
                  placeholder="HH:MM"
                />
                <TextInput
                  label="Break 2"
                  type="time"
                  value={ruleDraft.break2 || ''}
                  onChange={(event) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      break2: event.target.value,
                    }))
                  }
                  placeholder="HH:MM"
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Position"
                  value={ruleDraft.position}
                  readOnly
                  disabled
                />
                <TextInput
                  label="Department"
                  value={ruleDraft.department}
                  readOnly
                  disabled
                />
              </Group>

              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Working days
                </Text>
                <Pill.Group>
                  {dayOptions.map((day) => {
                    const isSelected = ruleDraft.daysOfWeek.includes(
                      Number(day.value)
                    );
                    return (
                      <Pill
                        key={day.value}
                        withRemoveButton={false}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'var(--mantine-color-blue-filled)'
                            : 'var(--mantine-color-gray-1)',
                          color: isSelected
                            ? 'var(--mantine-color-white)'
                            : 'var(--mantine-color-gray-7)',
                          border: isSelected
                            ? '1px solid var(--mantine-color-blue-filled)'
                            : '1px solid var(--mantine-color-gray-3)',
                        }}
                        onClick={() => {
                          const dayNum = Number(day.value);
                          setRuleDraft((prev) => ({
                            ...prev,
                            daysOfWeek: prev.daysOfWeek.includes(dayNum)
                              ? prev.daysOfWeek.filter((d) => d !== dayNum)
                              : [...prev.daysOfWeek, dayNum].sort(),
                          }));
                        }}
                      >
                        {day.label}
                      </Pill>
                    );
                  })}
                </Pill.Group>
                <Text size="xs" c="dimmed">
                  Sundays are excluded unless you select them explicitly.
                </Text>
              </Stack>

              <Group grow>
                <DateInput
                  label="Start date"
                  placeholder="mm/dd/yyyy"
                  value={parseDateValue(ruleDraft.startDate)}
                  onChange={(date) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      startDate: formatDateForInput(date),
                    }))
                  }
                  withAsterisk
                  valueFormat="MM/DD/YYYY"
                  clearable
                  {...COMMON_DATE_INPUT_PROPS}
                />
                <DateInput
                  label="End date"
                  placeholder="mm/dd/yyyy"
                  value={parseDateValue(ruleDraft.endDate)}
                  onChange={(date) =>
                    setRuleDraft((prev) => {
                      const normalized = formatDateForInput(date);
                      return {
                        ...prev,
                        endDate: normalized || undefined,
                      };
                    })
                  }
                  description="Leave empty to build the next 3 months."
                  valueFormat="MM/DD/YYYY"
                  clearable
                  {...COMMON_DATE_INPUT_PROPS}
                />
              </Group>

              <Textarea
                label="Notes"
                value={ruleDraft.notes || ''}
                onChange={(event) =>
                  setRuleDraft((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                minRows={2}
              />

              <Group justify="space-between" mt="sm">
                <Button
                  variant="default"
                  onClick={() =>
                    setRuleDraft({
                      employeeId: '',
                      employeeName: '',
                      position: '',
                      department: '',
                      shiftType: 'morning',
                      daysOfWeek: [1, 2, 3, 4, 5, 6],
                      startDate: '',
                      endDate: undefined,
                      break1: '',
                      lunch: '',
                      break2: '',
                      notes: '',
                      isStayIn: false,
                      id: undefined,
                    })
                  }
                >
                  Reset
                </Button>
                <Button onClick={handleSaveRule}>ADD SCHEDULE</Button>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Modal>
    </>
  );
});
