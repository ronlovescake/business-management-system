import { useEffect, useMemo, useState, memo } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Pill,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { getActionLabel } from '@/lib/accessibility';
import type { EmployeeSummary, RecurringRule, ShiftType } from '../types';

interface CalendarBulkActionsProps {
  recurringRules: RecurringRule[];
  onSaveRule: (rule: Omit<RecurringRule, 'id'> & { id?: string }) => string;
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
  recurringRules,
  onSaveRule,
  onDeleteRule,
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

  const handleSaveRule = () => {
    if (
      !ruleDraft.employeeId ||
      !ruleDraft.startDate ||
      ruleDraft.daysOfWeek.length === 0
    ) {
      alert('Employee, start date, and at least one work day are required');
      return;
    }

    const normalizedRule: RecurringRuleDraft = {
      ...ruleDraft,
      daysOfWeek: Array.from(new Set(ruleDraft.daysOfWeek)).sort(
        (a, b) => a - b
      ),
    };

    onSaveRule(normalizedRule);
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
    alert('Recurring rule saved');
  };

  const handleEditRule = (rule: RecurringRule) => {
    setRuleDraft({ ...rule });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm('Delete this recurring rule?')) {
      return;
    }
    onDeleteRule(ruleId);
    if (ruleDraft.id === ruleId) {
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
    }
  };

  return (
    <>
      <Modal
        opened={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Add Schedule"
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
                <TextInput
                  label="Start date"
                  type="date"
                  value={ruleDraft.startDate}
                  onChange={(event) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      startDate: event.target.value,
                    }))
                  }
                  withAsterisk
                />
                <TextInput
                  label="End date"
                  type="date"
                  value={ruleDraft.endDate || ''}
                  onChange={(event) =>
                    setRuleDraft((prev) => ({
                      ...prev,
                      endDate: event.target.value
                        ? event.target.value
                        : undefined,
                    }))
                  }
                  description="Leave empty to build the next 3 months."
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

          <Divider label="Existing rules" labelPosition="left" />

          <Stack gap="sm">
            {recurringRules.length === 0 && (
              <Text size="sm" c="dimmed">
                No recurring rules yet.
              </Text>
            )}

            {recurringRules.map((rule) => (
              <Card key={rule.id} withBorder shadow="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text fw={600}>{rule.employeeName}</Text>
                    <Text size="sm" c="dimmed">
                      {rule.position} · {rule.department}
                    </Text>
                    <Group gap={6}>
                      {rule.daysOfWeek.map((day) => (
                        <Badge key={day} variant="light">
                          {dayLabels[day]}
                        </Badge>
                      ))}
                    </Group>
                    <Text size="sm">
                      {rule.shiftType.toUpperCase()} · {rule.startDate}
                      {rule.endDate ? ` → ${rule.endDate}` : ' · ongoing'}
                    </Text>
                    {rule.notes && (
                      <Text size="sm" c="dimmed">
                        Notes: {rule.notes}
                      </Text>
                    )}
                  </Stack>
                  <Group gap="xs">
                    <Button
                      variant="light"
                      onClick={() => handleEditRule(rule)}
                    >
                      Edit
                    </Button>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => handleDeleteRule(rule.id)}
                      {...getActionLabel(
                        'Delete',
                        'recurring schedule rule',
                        `${rule.employeeName} - ${rule.shiftType}`
                      )}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Modal>
    </>
  );
});
