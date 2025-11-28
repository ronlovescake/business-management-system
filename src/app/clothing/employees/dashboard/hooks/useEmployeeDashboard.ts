'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import { dayjs } from '@/utils/date';
import type { DashboardViewMode, EmployeeDashboardResponse } from '../types';

const DATE_FORMAT = 'YYYY-MM-DD';

const defaultDay = dayjs().tz();

const defaultRange = {
  from: defaultDay.startOf('month').format(DATE_FORMAT),
  to: defaultDay.format(DATE_FORMAT),
};

const defaultDate = defaultDay.toDate();
const defaultMonth = defaultDay.startOf('month').toDate();
const defaultYear = defaultDay.startOf('year').toDate();

export function useEmployeeDashboard() {
  const [viewMode, setViewMode] = useState<DashboardViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate);
  const [selectedMonth, setSelectedMonth] = useState<Date>(defaultMonth);
  const [selectedYear, setSelectedYear] = useState<Date>(defaultYear);
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState<EmployeeDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computeRange = useCallback((mode: DashboardViewMode, value: Date) => {
    const base = dayjs(value).tz();

    if (mode === 'day') {
      const iso = base.format(DATE_FORMAT);
      return { from: iso, to: iso };
    }

    if (mode === 'month') {
      return {
        from: base.startOf('month').format(DATE_FORMAT),
        to: base.endOf('month').format(DATE_FORMAT),
      };
    }

    return {
      from: base.startOf('year').format(DATE_FORMAT),
      to: base.endOf('year').format(DATE_FORMAT),
    };
  }, []);

  const fetchData = useCallback(async (targetRange: typeof range) => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        from: targetRange.from,
        to: targetRange.to,
      }).toString();

      const response = await api.get<EmployeeDashboardResponse>(
        `/api/clothing/employees/dashboard?${query}`
      );

      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const handleViewModeChange = useCallback(
    (mode: DashboardViewMode) => {
      setViewMode(mode);

      if (mode === 'day') {
        setRange(computeRange('day', selectedDate));
        return;
      }

      if (mode === 'month') {
        setRange(computeRange('month', selectedMonth));
        return;
      }

      setRange(computeRange('year', selectedYear));
    },
    [computeRange, selectedDate, selectedMonth, selectedYear]
  );

  const handleDateChange = useCallback(
    (date: Date | null) => {
      if (!date) {
        return;
      }
      setSelectedDate(date);
      setRange(computeRange('day', date));
    },
    [computeRange]
  );

  const handleMonthChange = useCallback(
    (date: Date | null) => {
      if (!date) {
        return;
      }
      setSelectedMonth(date);
      if (viewMode === 'month') {
        setRange(computeRange('month', date));
      }
    },
    [computeRange, viewMode]
  );

  const handleYearChange = useCallback(
    (date: Date | null) => {
      if (!date) {
        return;
      }
      setSelectedYear(date);
      if (viewMode === 'year') {
        setRange(computeRange('year', date));
      }
    },
    [computeRange, viewMode]
  );

  const rangeLabel = useMemo(() => {
    if (!data) {
      return '';
    }

    if (data.range.from === data.range.to) {
      return dayjs(data.range.from).tz().format('MMMM D, YYYY');
    }

    const start = dayjs(data.range.from).tz().format('MMM D, YYYY');
    const end = dayjs(data.range.to).tz().format('MMM D, YYYY');
    return `${start} – ${end}`;
  }, [data]);

  return {
    data,
    loading,
    error,
    viewMode,
    range,
    rangeLabel,
    actions: {
      setViewMode: handleViewModeChange,
      setDate: handleDateChange,
      setMonth: handleMonthChange,
      setYear: handleYearChange,
      refetch: () => fetchData(range),
    },
    selections: {
      date: selectedDate,
      month: selectedMonth,
      year: selectedYear,
    },
  };
}
