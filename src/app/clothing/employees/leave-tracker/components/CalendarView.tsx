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
  isEmployeeScheduledOnDate: (
    employeeId: string,
    date: Date | string
  ) => boolean | null;
}

interface MonthCalendarProps {
  month: number;
  year: number;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  getLeaveRequestsForDate: (date: Date) => LeaveRequest[];
  getLeaveTypeColor: (leaveType: LeaveType) => string;
}

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date | null {
  if (!value) {
    return null;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
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
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '8px',
        border: '1px solid #e9ecef',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Month Name */}
      <Text
        fw={700}
        size="sm"
        mb={4}
        ta="center"
        c="dark"
        style={{ color: '#495057', fontSize: '13px' }}
      >
        {monthNames[month]}
      </Text>

      {/* Day Headers */}
      <SimpleGrid cols={7} spacing={1} mb={2}>
        {dayNames.map((day) => (
          <Text
            key={day}
            size="xs"
            ta="center"
            c="dimmed"
            fw={600}
            style={{ fontSize: '9px', color: '#868e96' }}
          >
            {day}
          </Text>
        ))}
      </SimpleGrid>

      {/* Calendar Grid */}
      <SimpleGrid cols={7} spacing={1} style={{ flex: 1 }}>
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
                  ? 'rgba(34, 139, 230, 0.2)'
                  : isTodayDay
                    ? 'rgba(34, 139, 230, 0.08)'
                    : hasLeave && isCurrent
                      ? 'rgba(240, 244, 248, 1)'
                      : 'transparent',
                border: isTodayDay
                  ? '2px solid #228be6'
                  : '1px solid transparent',
                transition: 'all 0.2s',
                position: 'relative',
                opacity: isCurrent ? 1 : 0.4,
              }}
              onMouseEnter={(e) => {
                if (isCurrent) {
                  e.currentTarget.style.backgroundColor = isSelectedDay
                    ? 'rgba(34, 139, 230, 0.3)'
                    : 'rgba(240, 244, 248, 1)';
                }
              }}
              onMouseLeave={(e) => {
                if (isCurrent) {
                  e.currentTarget.style.backgroundColor = isSelectedDay
                    ? 'rgba(34, 139, 230, 0.2)'
                    : isTodayDay
                      ? 'rgba(34, 139, 230, 0.08)'
                      : hasLeave
                        ? 'rgba(240, 244, 248, 1)'
                        : 'transparent';
                }
              }}
            >
              <Text
                size="xs"
                c={isCurrent ? 'dark' : 'dimmed'}
                fw={isTodayDay || isSelectedDay ? 700 : 500}
                style={{
                  fontSize: '11px',
                  color: isCurrent ? '#212529' : '#adb5bd',
                }}
              >
                {date.getDate()}
              </Text>

              {/* Leave Indicators */}
              {hasLeave && isCurrent && (
                <Group
                  gap={1}
                  mt={1}
                  style={{
                    position: 'absolute',
                    bottom: 1,
                  }}
                >
                  {requests.slice(0, 3).map((request) => (
                    <Box
                      key={request.id}
                      style={{
                        width: 3,
                        height: 3,
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

export const CalendarView = React.memo(function CalendarView({
  leaveRequests,
  formatDate,
  getLeaveTypeColor,
  isEmployeeScheduledOnDate,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Get all months for the year
  const months = Array.from({ length: 12 }, (_, i) => i);

  // Helper to check if a date has leave requests
  const getLeaveRequestsForDate = (date: Date) => {
    const current = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    return leaveRequests.filter((request) => {
      const start = parseDateOnly(request.startDate);
      const end = parseDateOnly(request.endDate);

      if (!start || !end) {
        return false;
      }

      if (current < start || current > end) {
        return false;
      }

      const scheduled = isEmployeeScheduledOnDate(request.employeeId, current);

      if (scheduled === false) {
        return false;
      }

      return true;
    });
  };

  // Get requests for selected date
  const selectedDateRequests = selectedDate
    ? getLeaveRequestsForDate(selectedDate)
    : [];

  return (
    <Card
      padding="md"
      radius="lg"
      style={{
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        minHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Stack gap="md" style={{ flex: 1 }}>
        {/* Header with Year Navigation */}
        <Group justify="space-between" align="center">
          <Title
            order={3}
            style={{
              color: '#212529',
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
        <Box
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            width: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SimpleGrid
            cols={{ base: 1, sm: 2, md: 3, lg: 4 }}
            spacing="xs"
            style={{ flex: 1 }}
          >
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
        </Box>

        {/* Selected Date Details */}
        {selectedDate && selectedDateRequests.length > 0 && (
          <Card
            padding="md"
            radius="md"
            style={{
              background: 'white',
              border: '1px solid #e9ecef',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Stack gap="sm">
              <Title order={5} c="dark" style={{ color: '#212529' }}>
                Leave Requests on {formatDate(toDateOnlyString(selectedDate))}
              </Title>
              {selectedDateRequests.map((request) => (
                <Group key={request.id} justify="space-between">
                  <div>
                    <Text fw={600} c="dark" style={{ color: '#212529' }}>
                      {request.employeeName}
                    </Text>
                    <Text size="sm" c="dimmed" style={{ color: '#868e96' }}>
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
                    <Text size="sm" c="dimmed" style={{ color: '#868e96' }}>
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
            background: 'white',
            border: '1px solid #e9ecef',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Group gap="md">
            <Text size="sm" fw={600} c="dark" style={{ color: '#212529' }}>
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
                  <Text size="xs" c="dimmed" style={{ color: '#868e96' }}>
                    {type}
                  </Text>
                </Group>
              )
            )}
          </Group>
        </Card>

        {/* Summary */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed" style={{ color: '#868e96' }}>
            Click on any date to see leave details
          </Text>
          <Text size="sm" fw={600} c="dark" style={{ color: '#212529' }}>
            Total Requests: {leaveRequests.length}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
});
