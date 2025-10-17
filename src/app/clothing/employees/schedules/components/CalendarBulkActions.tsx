import { useMemo, useState } from 'react';
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
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import {
  IconCalendarStats,
  IconDeviceFloppy,
  IconPlus,
  IconRepeat,
  IconTemplate,
  IconTrash,
} from '@tabler/icons-react';
import type {
  EmployeeSummary,
  RecurringRule,
  ShiftType,
  TemplateAssignment,
  WeeklyTemplate,
} from '../types';

interface CalendarBulkActionsProps {
  templates: WeeklyTemplate[];
  recurringRules: RecurringRule[];
  onSaveTemplate: (
    template: Omit<WeeklyTemplate, 'id'> & { id?: string }
  ) => string;
  onDeleteTemplate: (id: string) => void;
  onApplyTemplate: (
    templateId: string,
    targetDate: string
  ) => {
    added: number;
    skipped: number;
  };
  onSaveRule: (rule: Omit<RecurringRule, 'id'> & { id?: string }) => string;
  onDeleteRule: (id: string) => void;
  employees: EmployeeSummary[];
  isLoadingEmployees: boolean;
  shiftConfig: Record<ShiftType, { start: string; end: string; label: string }>;
  dayLabels: string[];
}

interface TemplateDraft extends Omit<WeeklyTemplate, 'id'> {
  id?: string;
}

interface RecurringRuleDraft extends Omit<RecurringRule, 'id'> {
  id?: string;
}

function buildAssignmentId() {
  return `assignment_${Math.random().toString(36).slice(2, 11)}`;
}

export function CalendarBulkActions({
  templates,
  recurringRules,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  onSaveRule,
  onDeleteRule,
  employees,
  isLoadingEmployees,
  shiftConfig,
  dayLabels,
}: CalendarBulkActionsProps) {
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [templateTab, setTemplateTab] = useState<string | null>('apply');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [weekStartDate, setWeekStartDate] = useState('');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    name: '',
    description: '',
    assignments: [],
    allowSundayAssignments: false,
  });
  const [ruleDraft, setRuleDraft] = useState<RecurringRuleDraft>({
    employeeId: '',
    employeeName: '',
    position: '',
    department: '',
    shiftType: 'morning',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    startDate: '',
    endDate: undefined,
    notes: '',
    isStayIn: false,
  });

  const dayOptions = useMemo(
    () =>
      dayLabels.map((label, index) => ({
        value: index.toString(),
        label,
      })),
    [dayLabels]
  );

  const stayInEmployeeIds = useMemo(() => {
    return new Set(
      employees
        .filter((emp) => emp.employeeType === 'stay-in')
        .map((emp) => emp.employeeId)
    );
  }, [employees]);

  const handleResetTemplateDraft = () => {
    setTemplateDraft({
      id: undefined,
      name: '',
      description: '',
      assignments: [],
      allowSundayAssignments: false,
    });
    setTemplateTab('apply');
  };

  const handleLoadTemplateDraft = (template: WeeklyTemplate) => {
    setTemplateDraft({ ...template });
    setTemplateTab('edit');
  };

  const handleAssignmentChange = <K extends keyof TemplateAssignment>(
    assignmentId: string,
    key: K,
    value: TemplateAssignment[K]
  ) => {
    setTemplateDraft((prev) => ({
      ...prev,
      assignments: prev.assignments.map((assignment) =>
        assignment.id === assignmentId
          ? { ...assignment, [key]: value }
          : assignment
      ),
    }));
  };

  const handleSelectAssignmentEmployee = (
    assignmentId: string,
    employeeId: string
  ) => {
    const employee = employees.find((emp) => emp.employeeId === employeeId);
    if (!employee) {
      return;
    }

    const stayIn = employee.employeeType === 'stay-in';

    const currentAssignment = templateDraft.assignments.find(
      (assignment) => assignment.id === assignmentId
    );

    const baseShiftType = currentAssignment?.shiftType || 'morning';
    const resolvedShiftType: ShiftType = stayIn ? 'full-day' : baseShiftType;
    const defaults = shiftConfig[resolvedShiftType];

    setTemplateDraft((prev) => ({
      ...prev,
      assignments: prev.assignments.map((assignment) =>
        assignment.id === assignmentId
          ? {
              ...assignment,
              employeeId: employee.employeeId,
              employeeName: employee.name,
              department: employee.department,
              role: employee.position,
              isStayIn: stayIn,
              shiftType: resolvedShiftType,
              startTime: stayIn
                ? shiftConfig['full-day'].start
                : assignment.startTime || defaults.start,
              endTime: stayIn
                ? shiftConfig['full-day'].end
                : assignment.endTime || defaults.end,
            }
          : assignment
      ),
    }));
  };

  const handleAddAssignment = () => {
    const defaults = shiftConfig['morning'];
    setTemplateDraft((prev) => ({
      ...prev,
      assignments: [
        ...prev.assignments,
        {
          id: buildAssignmentId(),
          dayOfWeek: 1,
          shiftType: 'morning',
          role: '',
          department: '',
          startTime: defaults.start,
          endTime: defaults.end,
        },
      ],
    }));
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    setTemplateDraft((prev) => ({
      ...prev,
      assignments: prev.assignments.filter(
        (assignment) => assignment.id !== assignmentId
      ),
    }));
  };

  const handleSaveTemplateDraft = () => {
    if (!templateDraft.name.trim()) {
      alert('Template name is required');
      return;
    }

    if (templateDraft.assignments.length === 0) {
      alert('Add at least one assignment to the template');
      return;
    }

    const missing = templateDraft.assignments.find(
      (assignment) =>
        !assignment.employeeId || assignment.dayOfWeek === undefined
    );

    if (missing) {
      alert('Each assignment needs an employee and a day of week');
      return;
    }

    const templateId = onSaveTemplate(templateDraft);
    setSelectedTemplateId(templateId);
    alert('Template saved successfully');
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) {
      alert('Select a template to apply');
      return;
    }

    if (!weekStartDate) {
      alert('Select a date to anchor the week');
      return;
    }

    const result = onApplyTemplate(selectedTemplateId, weekStartDate);
    alert(
      `Template applied. Added ${result.added} schedule(s). Skipped ${result.skipped} conflicting assignment(s).`
    );
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('Delete this template?')) {
      return;
    }
    onDeleteTemplate(templateId);
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(null);
    }
    if (templateDraft.id === templateId) {
      handleResetTemplateDraft();
    }
  };

  const handleOpenTemplateModal = () => {
    setTemplateModalOpen(true);
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  };

  const handleCloseTemplateModal = () => {
    setTemplateModalOpen(false);
    handleResetTemplateDraft();
  };

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
        notes: '',
        isStayIn: false,
        id: undefined,
      });
    }
  };

  const dayOfWeekOptionsWithoutSunday = useMemo(
    () => dayOptions.slice(1),
    [dayOptions]
  );

  return (
    <Group gap="sm">
      <Button
        leftSection={<IconTemplate size={16} />}
        variant="light"
        onClick={handleOpenTemplateModal}
      >
        Weekly Templates
      </Button>
      <Button
        leftSection={<IconRepeat size={16} />}
        variant="light"
        onClick={() => setRuleModalOpen(true)}
      >
        Recurring Rules
      </Button>

      <Modal
        opened={templateModalOpen}
        onClose={handleCloseTemplateModal}
        title="Weekly Templates"
        size="xl"
      >
        <Tabs value={templateTab} onChange={setTemplateTab} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab
              value="apply"
              leftSection={<IconCalendarStats size={16} />}
            >
              Apply Template
            </Tabs.Tab>
            <Tabs.Tab value="edit" leftSection={<IconDeviceFloppy size={16} />}>
              Create / Edit Template
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="apply" pt="md">
            <Stack>
              <Select
                label="Template"
                placeholder="Select template"
                data={templates.map((template) => ({
                  value: template.id,
                  label: template.name,
                }))}
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                withAsterisk
              />
              <TextInput
                label="Week anchor date"
                type="date"
                value={weekStartDate}
                onChange={(event) => setWeekStartDate(event.target.value)}
                withAsterisk
                description="The selected template fills the week containing this date."
              />
              <Group justify="space-between">
                <Group gap="xs">
                  <Button
                    variant="light"
                    disabled={!selectedTemplateId}
                    onClick={() => {
                      const template = templates.find(
                        (item) => item.id === selectedTemplateId
                      );
                      if (template) {
                        handleLoadTemplateDraft(template);
                      }
                    }}
                  >
                    Edit Template
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    disabled={!selectedTemplateId}
                    onClick={() =>
                      selectedTemplateId &&
                      handleDeleteTemplate(selectedTemplateId)
                    }
                    leftSection={<IconTrash size={16} />}
                  >
                    Delete Template
                  </Button>
                </Group>
                <Button
                  onClick={handleApplyTemplate}
                  leftSection={<IconTemplate size={16} />}
                >
                  Apply
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="edit" pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <TextInput
                  label="Template Name"
                  placeholder="e.g., Weekday Morning Crew"
                  value={templateDraft.name}
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  withAsterisk
                  style={{ flex: 1 }}
                />
                <Switch
                  label="Allow Sunday assignments"
                  checked={templateDraft.allowSundayAssignments ?? false}
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      allowSundayAssignments: event.currentTarget.checked,
                    }))
                  }
                />
              </Group>

              <Textarea
                label="Description"
                placeholder="Optional description"
                value={templateDraft.description || ''}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                minRows={2}
              />

              <Divider label="Assignments" labelPosition="left" />

              <Stack gap="sm">
                {templateDraft.assignments.map((assignment) => (
                  <Card key={assignment.id} withBorder shadow="sm">
                    <Stack gap="xs">
                      <Group align="flex-end">
                        <Select
                          label="Day"
                          style={{ flex: 1 }}
                          data={
                            templateDraft.allowSundayAssignments
                              ? dayOptions
                              : dayOfWeekOptionsWithoutSunday
                          }
                          value={assignment.dayOfWeek.toString()}
                          onChange={(value) =>
                            handleAssignmentChange(
                              assignment.id,
                              'dayOfWeek',
                              Number(value || assignment.dayOfWeek)
                            )
                          }
                        />
                        <Select
                          label="Employee"
                          placeholder="Select employee"
                          style={{ flex: 2 }}
                          data={employees.map((emp) => ({
                            value: emp.employeeId,
                            label: `${emp.name} (${emp.employeeId})`,
                          }))}
                          value={assignment.employeeId || null}
                          onChange={(value) =>
                            value &&
                            handleSelectAssignmentEmployee(assignment.id, value)
                          }
                          searchable
                          disabled={isLoadingEmployees}
                        />
                        <Select
                          label="Shift"
                          style={{ flex: 1 }}
                          data={Object.entries(shiftConfig).map(
                            ([value, config]) => ({
                              value,
                              label: config.label,
                            })
                          )}
                          value={assignment.shiftType}
                          onChange={(value) =>
                            handleAssignmentChange(
                              assignment.id,
                              'shiftType',
                              (value as ShiftType) || assignment.shiftType
                            )
                          }
                          disabled={
                            !!assignment.employeeId &&
                            stayInEmployeeIds.has(assignment.employeeId)
                          }
                        />
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>

                      <Group grow>
                        <TextInput
                          label="Role"
                          value={assignment.role}
                          onChange={(event) =>
                            handleAssignmentChange(
                              assignment.id,
                              'role',
                              event.target.value
                            )
                          }
                        />
                        <TextInput
                          label="Department"
                          value={assignment.department}
                          onChange={(event) =>
                            handleAssignmentChange(
                              assignment.id,
                              'department',
                              event.target.value
                            )
                          }
                        />
                        <TextInput
                          label="Start"
                          type="time"
                          value={assignment.startTime || ''}
                          onChange={(event) =>
                            handleAssignmentChange(
                              assignment.id,
                              'startTime',
                              event.target.value
                            )
                          }
                        />
                        <TextInput
                          label="End"
                          type="time"
                          value={assignment.endTime || ''}
                          onChange={(event) =>
                            handleAssignmentChange(
                              assignment.id,
                              'endTime',
                              event.target.value
                            )
                          }
                        />
                      </Group>

                      <Textarea
                        label="Notes"
                        value={assignment.notes || ''}
                        onChange={(event) =>
                          handleAssignmentChange(
                            assignment.id,
                            'notes',
                            event.target.value
                          )
                        }
                        minRows={2}
                      />

                      {assignment.employeeId &&
                        stayInEmployeeIds.has(assignment.employeeId) && (
                          <Badge color="cyan" variant="light" w="fit-content">
                            Stay-in: auto-set to Full Day
                          </Badge>
                        )}
                    </Stack>
                  </Card>
                ))}

                <Button
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={handleAddAssignment}
                >
                  Add assignment
                </Button>
              </Stack>

              <Group justify="space-between" mt="md">
                <Button variant="default" onClick={handleResetTemplateDraft}>
                  Reset
                </Button>
                <Button
                  onClick={handleSaveTemplateDraft}
                  leftSection={<IconDeviceFloppy size={16} />}
                >
                  Save Template
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      <Modal
        opened={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title="Recurring Rules"
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
                      notes: '',
                      isStayIn: false,
                      id: undefined,
                    })
                  }
                >
                  Reset
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSaveRule}
                >
                  Save Rule
                </Button>
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
    </Group>
  );
}
