'use client';

import { useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type {
  TemplateRecord,
  TemplateStatus,
  TemplateSummary,
} from '../types/template.types';

const sampleRecords: TemplateRecord[] = [
  {
    id: 'tmpl-001',
    date: '2025-12-01',
    primary: 'Alpha',
    secondary: 'Bravo',
    category: 'Segment A',
    metricIn: 52000,
    metricOut: 18200,
    notes: 'Demo record with positive net.',
    status: 'in-progress',
  },
  {
    id: 'tmpl-002',
    date: '2025-12-03',
    primary: 'Charlie',
    secondary: 'Delta',
    category: 'Segment B',
    metricIn: 41000,
    metricOut: 20500,
    notes: 'Includes adjustments.',
    status: 'scheduled',
  },
  {
    id: 'tmpl-003',
    date: '2025-11-28',
    primary: 'Echo',
    secondary: 'Foxtrot',
    category: 'Segment A',
    metricIn: 36500,
    metricOut: 16200,
    notes: 'Recent activity.',
    status: 'completed',
  },
  {
    id: 'tmpl-004',
    date: '2025-11-20',
    primary: 'Golf',
    secondary: 'Hotel',
    category: 'Segment C',
    metricIn: 28200,
    metricOut: 17800,
    notes: 'Older record.',
    status: 'completed',
  },
];

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const normalize = (value: string) => value.toLowerCase().trim();

const daysAgoDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const statusColors: Record<TemplateStatus, string> = {
  scheduled: 'blue',
  'in-progress': 'yellow',
  completed: 'green',
  cancelled: 'red',
};

export function useTemplateDashboard() {
  const [records] = useState<TemplateRecord[]>(sampleRecords);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | 'all'>(
    'all'
  );
  const [dateRange, setDateRange] = useState<'all' | '7' | '30'>('all');
  const [isImporting, setIsImporting] = useState(false);

  const formatCurrency = (value: number) => pesoFormatter.format(value);

  const filteredRecords = useMemo(() => {
    const query = normalize(searchQuery);
    const hasQuery = query.length > 0;
    const threshold =
      dateRange === 'all' ? null : daysAgoDate(Number(dateRange));

    return records.filter((record) => {
      if (
        categoryFilter &&
        normalize(record.category) !== normalize(categoryFilter)
      ) {
        return false;
      }

      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }

      if (threshold) {
        const recordDate = new Date(record.date);
        if (recordDate < threshold) {
          return false;
        }
      }

      if (!hasQuery) {
        return true;
      }

      const haystack = [record.primary, record.secondary, record.notes]
        .filter(Boolean)
        .map((value) => normalize(value as string));

      return haystack.some((value) => value.includes(query));
    });
  }, [categoryFilter, dateRange, records, searchQuery, statusFilter]);

  const sumField = (items: TemplateRecord[], key: keyof TemplateRecord) =>
    items.reduce((sum, item) => sum + (item[key] as number), 0);

  const totalIn = useMemo(() => sumField(records, 'metricIn'), [records]);
  const totalOut = useMemo(() => sumField(records, 'metricOut'), [records]);
  const net = useMemo(() => totalIn - totalOut, [totalIn, totalOut]);

  const filteredIn = useMemo(
    () => sumField(filteredRecords, 'metricIn'),
    [filteredRecords]
  );
  const filteredOut = useMemo(
    () => sumField(filteredRecords, 'metricOut'),
    [filteredRecords]
  );
  const filteredNet = useMemo(
    () => filteredIn - filteredOut,
    [filteredIn, filteredOut]
  );

  const recordsThisMonth = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return records.filter((record) => {
      const d = new Date(record.date);
      return d.getMonth() === m && d.getFullYear() === y;
    }).length;
  }, [records]);

  const categories = useMemo(
    () => Array.from(new Set(records.map((r) => r.category))).sort(),
    [records]
  );

  const summaries: TemplateSummary = {
    totalCount: records.length,
    filteredCount: filteredRecords.length,
    filteredMetricIn: filteredIn,
    filteredMetricOut: filteredOut,
    filteredNet,
  };

  const getStatusColor = (status: TemplateStatus) => statusColors[status];

  const handleImport = async (file: File | null) => {
    if (!file) {
      return;
    }
    setIsImporting(true);
    try {
      await file.text();
      showNotification({
        title: 'Import complete',
        message: `${file.name} processed.`,
      });
    } catch (error) {
      showNotification({
        color: 'red',
        title: 'Import failed',
        message: 'Could not import file.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    showNotification({
      title: 'Export triggered',
      message: 'Replace with real export logic.',
    });
  };

  const handleAdd = () => {
    showNotification({
      title: 'Add record',
      message: 'Replace with real create flow.',
    });
  };

  return {
    records: filteredRecords,
    stats: {
      totalIn,
      totalOut,
      net,
      recordsThisMonth,
    },
    summary: summaries,
    filters: {
      searchQuery,
      setSearchQuery,
      categoryFilter,
      setCategoryFilter,
      statusFilter,
      setStatusFilter,
      dateRange,
      setDateRange,
      isImporting,
    },
    collections: {
      categories,
    },
    actions: {
      handleImport,
      handleExport,
      handleAdd,
    },
    getStatusColor,
    formatCurrency,
  };
}
