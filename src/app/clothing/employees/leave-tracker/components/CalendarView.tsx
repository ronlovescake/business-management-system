import React, { useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Badge,
  Group,
  SimpleGrid,
  Box,
  Button,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { LeaveRequest, LeaveType } from '../types';

interface CalendarViewProps {
  leaveRequests: LeaveRequest[];
  formatDate: (date: string) => string;
  getLeaveTypeColor: (leaveType: LeaveType) => string;
}

interface MonthCalendarProps {
  month: number;
  year: number;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  getLeaveRequestsForDate: (date: Date) => LeaveRequest[];
  getLeaveTypeColor: (leaveType: LeaveType) => string;
}

function MonthCalendar({
  month,
  year,
  selectedDate,
  onSelectDate,
  getLeaveRequestsForDate,
  getLeaveTypeColor,
}: MonthCalendarProps) {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Create calendar grid
  const calendarDays: (Date | null)[] = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push(new Date(year, month - 1, daysInPrevMonth - i));
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  // Next month days to fill the grid
  const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push(new Date(year, month + 1, day));
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) {
      return false;
    }
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === month;
  };

  return (
    <Box
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Month Name */}
      <Text
        fw={600}
        size="sm"
        mb="xs"
        ta="center"
        c="white"
        style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)' }}
      >
        {monthNames[month]}
      </Text>

      {/* Day Headers */}
      <SimpleGrid cols={7} spacing={2} mb={4}>
        {dayNames.map((day) => (
          <Text
            key={day}
            size="xs"
            ta="center"
            c="dimmed"
            fw={600}
            style={{ fontSize: '10px' }}
          >
            {day}
          </Text>
        ))}
      </SimpleGrid>

      {/* Calendar Grid */}
      <SimpleGrid cols={7} spacing={2}>
        {calendarDays.map((date) => {
          if (!date) {
            return <Box key={`empty-${month}-${Math.random()}`} />;
          }

          const dateKey = `${year}-${date.getMonth()}-${date.getDate()}-${date.getTime()}`;
          const requests = getLeaveRequestsForDate(date);
          const hasLeave = requests.length > 0;
          const isCurrent = isCurrentMonth(date);
          const isSelectedDay = isSelected(date);
          const isTodayDay = isToday(date);

          return (
            <Box
              key={dateKey}
              onClick={() => isCurrent && onSelectDate(date)}
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                cursor: isCurrent ? 'pointer' : 'default',
                backgroundColor: isSelectedDay
                  ? 'rgba(34, 139, 230, 0.3)'
                  : isTodayDay
                    ? 'rgba(34, 139, 230, 0.15)'
                    : hasLeave && isCurrent
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'transparent',
                border: isTodayDay
                  ? '1px solid rgba(34, 139, 230, 0.5)'
                  : '1px solid transparent',
                transition: 'all 0.2s',
                position: 'relative',
                opacity: isCurrent ? 1 : 0.3,
              }}
              onMouseEnter={(e) => {
                if (isCurrent) {
                  e.currentTarget.style.backgroundColor = isSelectedDay
                    ? 'rgba(34, 139, 230, 0.4)'
                    : 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (isCurrent) {
                  e.currentTarget.style.backgroundColor = isSelectedDay
                    ? 'rgba(34, 139, 230, 0.3)'
                    : isTodayDay
                      ? 'rgba(34, 139, 230, 0.15)'
                      : hasLeave
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'transparent';
                }
              }}
            >
              <Text
                size="xs"
                c={isCurrent ? 'white' : 'dimmed'}
                fw={isSelectedDay || isTodayDay ? 600 : 400}
                style={{ fontSize: '11px' }}
              >
                {date.getDate()}
              </Text>

              {/* Leave Indicators */}
              {hasLeave && isCurrent && (
                <Group
                  gap={2}
                  mt={2}
                  style={{
                    position: 'absolute',
                    bottom: 2,
                  }}
                >
                  {requests.slice(0, 3).map((request) => (
                    <Box
                      key={request.id}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: `var(--mantine-color-${getLeaveTypeColor(request.leaveType)}-6)`,
                      }}
                    />
                  ))}
                </Group>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}

export function CalendarView({
  leaveRequests,
  formatDate,
  getLeaveTypeColor,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Get all months for the year
  const months = Array.from({ length: 12 }, (_, i) => i);

  // Helper to check if a date has leave requests
  const getLeaveRequestsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return leaveRequests.filter((request) => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  // Get requests for selected date
  const selectedDateRequests = selectedDate
    ? getLeaveRequestsForDate(selectedDate)
    : [];

  return (
    <Card
      padding="lg"
      radius="xl"
      style={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
      }}
    >
      <Stack gap="lg">
        {/* Header with Year Navigation */}
        <Group justify="space-between" align="center">
          <Title
            order={3}
            style={{
              color: 'rgba(255, 255, 255, 0.95)',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            Leave Calendar - {currentYear}
          </Title>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => setCurrentYear((y) => y - 1)}
              leftSection={<IconChevronLeft size={16} />}
            >
              {currentYear - 1}
            </Button>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => setCurrentYear((y) => y + 1)}
              rightSection={<IconChevronRight size={16} />}
            >
              {currentYear + 1}
            </Button>
          </Group>
        </Group>

        {/* Year View - 12 Month Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
          {months.map((month) => (
            <MonthCalendar
              key={month}
              month={month}
              year={currentYear}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              getLeaveRequestsForDate={getLeaveRequestsForDate}
              getLeaveTypeColor={getLeaveTypeColor}
            />
          ))}
        </SimpleGrid>

        {/* Selected Date Details */}
        {selectedDate && selectedDateRequests.length > 0 && (
          <Card
            padding="md"
            radius="md"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Stack gap="sm">
              <Title order={5} c="white">
                Leave Requests on{' '}
                {formatDate(selectedDate.toISOString().split('T')[0])}
              </Title>
              {selectedDateRequests.map((request) => (
                <Group key={request.id} justify="space-between">
                  <div>
                    <Text fw={600} c="white">
                      {request.employeeName}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {request.reason}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Badge
                      color={getLeaveTypeColor(request.leaveType)}
                      variant="light"
                    >
                      {request.leaveType}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {request.numberOfDays}{' '}
                      {request.numberOfDays === 1 ? 'day' : 'days'}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {/* Legend */}
        <Card
          padding="sm"
          radius="md"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Group gap="md">
            <Text size="sm" fw={600} c="white">
              Legend:
            </Text>
            {['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Other'].map(
              (type) => (
                <Group key={type} gap={4}>
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: `var(--mantine-color-${getLeaveTypeColor(type as LeaveType)}-6)`,
                    }}
                  />
                  <Text size="xs" c="dimmed">
                    {type}
                  </Text>
                </Group>
              )
            )}
          </Group>
        </Card>

        {/* Summary */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Click on any date to see leave details
          </Text>
          <Text size="sm" fw={600} c="white">
            Total Requests: {leaveRequests.length}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
