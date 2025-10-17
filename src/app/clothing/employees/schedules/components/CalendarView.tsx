import { useState, useMemo } from 'react';
import {
  Card,
  Group,
  Button,
  Text,
  Stack,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from '@tabler/icons-react';
import type { Schedule, ShiftType, ScheduleStatus } from '../types';

interface CalendarViewProps {
  schedules: Schedule[];
  getShiftTypeColor: (shiftType: ShiftType) => string;
  getStatusColor: (status: ScheduleStatus) => string;
  onAddSchedule: () => void;
  onEditSchedule: (schedule: Schedule) => void;
}

export function CalendarView({
  schedules,
  getShiftTypeColor,
  getStatusColor: _getStatusColor,
  onAddSchedule,
  onEditSchedule,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get the first day of the current month
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  // Get the last day of the current month
  const lastDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  }, [currentDate]);

  // Get the starting day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
  const startingDayOfWeek = useMemo(() => {
    return firstDayOfMonth.getDay();
  }, [firstDayOfMonth]);

  // Get total days in the month
  const daysInMonth = useMemo(() => {
    return lastDayOfMonth.getDate();
  }, [lastDayOfMonth]);

  // Generate calendar days
  type CalendarCell =
    | { type: 'empty'; id: string }
    | { type: 'day'; value: number };

  const calendarDays = useMemo(() => {
    const cells: CalendarCell[] = [];
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      cells.push({ type: 'empty', id: `${monthKey}-leading-${i}` });
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ type: 'day', value: day });
    }

    // Ensure the grid is filled with trailing empty cells for consistent rows
    const totalCells = Math.ceil(cells.length / 7) * 7;
    const trailingCells = totalCells - cells.length;

    for (let i = 0; i < trailingCells; i++) {
      cells.push({ type: 'empty', id: `${monthKey}-trailing-${i}` });
    }

    return cells;
  }, [currentDate, daysInMonth, startingDayOfWeek]);

  const weeksInMonth = useMemo(() => {
    return Math.ceil(calendarDays.length / 7);
  }, [calendarDays]);

  // Get schedules for a specific date
  const getSchedulesForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter((schedule) => schedule.date === dateStr);
  };

  // Check if a date is Sunday
  const isSunday = (day: number) => {
    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    );
    return date.getDay() === 0;
  };

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format month and year
  const monthYear = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [currentDate]);

  // Check if current month is today's month
  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return (
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  }, [currentDate]);

  // Check if a specific day is today
  const isToday = (day: number) => {
    const now = new Date();
    return (
      day === now.getDate() &&
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getFullYear() === now.getFullYear()
    );
  };

  return (
    <Stack gap="md">
      {/* Calendar Header */}
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={previousMonth}
              size="lg"
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
            <Text size="xl" fw={600}>
              {monthYear}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={nextMonth}
              size="lg"
            >
              <IconChevronRight size={20} />
            </ActionIcon>
          </Group>
          <Group>
            {!isCurrentMonth && (
              <Button variant="light" onClick={goToToday}>
                Today
              </Button>
            )}
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={onAddSchedule}
            >
              Add Schedule
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Calendar Grid */}
      <Card
        withBorder
        padding="md"
        radius="md"
        style={{ height: '75vh', display: 'flex', flexDirection: 'column' }}
      >
        <Stack gap="xs" style={{ flex: 1 }}>
          {/* Day Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: day === 'Sun' ? '#fa5252' : '#495057',
                  padding: '8px',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: `repeat(${weeksInMonth}, 1fr)`,
              gap: '8px',
            }}
          >
            {calendarDays.map((cell) => {
              if (cell.type === 'empty') {
                return <div key={cell.id} style={{ height: '100%' }} />;
              }

              const day = cell.value;
              const daySchedules = getSchedulesForDate(day);
              const isRestDay = isSunday(day);
              const isTodayDate = isToday(day);

              return (
                <Card
                  key={day}
                  padding="xs"
                  withBorder
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: isRestDay
                      ? '#fff5f5'
                      : isTodayDate
                        ? '#e7f5ff'
                        : 'white',
                    borderColor: isTodayDate ? '#228be6' : undefined,
                    borderWidth: isTodayDate ? '2px' : '1px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isRestDay) {
                      e.currentTarget.style.boxShadow =
                        '0 4px 12px rgba(0,0,0,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  <Stack gap={4}>
                    {/* Day Number */}
                    <Group justify="space-between">
                      <Text
                        size="sm"
                        fw={isTodayDate ? 700 : 600}
                        c={isRestDay ? 'red' : isTodayDate ? 'blue' : 'dark'}
                      >
                        {day}
                      </Text>
                      {isRestDay && (
                        <Badge size="xs" color="red" variant="light">
                          Rest
                        </Badge>
                      )}
                    </Group>

                    {/* Schedules for this day */}
                    <Stack gap={2}>
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <Tooltip
                          key={schedule.id}
                          label={`${schedule.employeeName} - ${schedule.position}`}
                          position="top"
                        >
                          <Badge
                            size="xs"
                            color={getShiftTypeColor(schedule.shiftType)}
                            variant="filled"
                            style={{
                              cursor: 'pointer',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() => onEditSchedule(schedule)}
                          >
                            {schedule.employeeName.split(' ')[0]} -{' '}
                            {schedule.shiftType === 'full-day'
                              ? 'Full'
                              : schedule.shiftType === 'morning'
                                ? 'AM'
                                : schedule.shiftType === 'afternoon'
                                  ? 'PM'
                                  : 'Night'}
                          </Badge>
                        </Tooltip>
                      ))}
                      {daySchedules.length > 3 && (
                        <Text size="xs" c="dimmed" ta="center">
                          +{daySchedules.length - 3} more
                        </Text>
                      )}
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </div>
        </Stack>
      </Card>

      {/* Legend */}
      <Card withBorder padding="md" radius="md">
        <Group gap="lg">
          <Text size="sm" fw={600}>
            Shift Types:
          </Text>
          <Badge color={getShiftTypeColor('morning')} variant="light">
            Morning (8AM-5PM)
          </Badge>
          <Badge color={getShiftTypeColor('afternoon')} variant="light">
            Afternoon (3PM-12AM)
          </Badge>
          <Badge color={getShiftTypeColor('night')} variant="light">
            Night (12AM-9AM)
          </Badge>
          <Badge color={getShiftTypeColor('full-day')} variant="light">
            Full Day (4AM-5PM)
          </Badge>
        </Group>
      </Card>
    </Stack>
  );
}
