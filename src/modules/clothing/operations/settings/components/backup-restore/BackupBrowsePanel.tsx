'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Drawer,
  Group,
  Loader,
  Menu,
  NavLink,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconColumns,
  IconDownload,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import Papa from 'papaparse';
import { StandardDataTable } from '@/components/tables/StandardDataTable';
import { createRowKey, formatCellValue } from '../../backup/types';
import { useBackupBrowse } from './useBackupBrowse';
import type { Backup } from '../../backup/types';
import styles from './backupWorkspace.module.css';

export function BackupBrowsePanel({ backup }: { backup: Backup }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('backupTable')
  );
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState('250');
  const [tableSearch, setTableSearch] = useState('');
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const { catalog } = useBackupBrowse(backup.timestamp, null, 0, Number(limit));
  const table =
    catalog.data?.tables.find((entry) => entry.key === selected) ??
    catalog.data?.tables[0];
  const { rows } = useBackupBrowse(
    backup.timestamp,
    table?.key ?? null,
    offset,
    Number(limit)
  );
  const columns = (rows.data?.columns ?? []).filter(
    (column) => !hidden.includes(column)
  );
  const filtered = (rows.data?.rows ?? []).filter(
    (row) =>
      !search.trim() ||
      Object.values(row).some((value) =>
        formatCellValue(value)
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
  );
  const chooseTable = (key: string) => {
    setSelected(key);
    setOffset(0);
    setSearch('');
    setHidden([]);
    setCancelled(false);
    setDetail(null);
    const url = new URL(window.location.href);
    url.searchParams.set('backupTable', key);
    window.history.replaceState(null, '', url);
  };
  const retry = () => {
    setCancelled(false);
    void (!catalog.data || catalog.isError
      ? catalog.refetch()
      : rows.refetch());
  };
  const download = () => {
    const blob = new Blob(
      [Papa.unparse(rows.data?.rows ?? [], { escapeFormulae: true })],
      { type: 'text/csv;charset=utf-8;' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${table?.key ?? 'table'}-page.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Stack gap="sm">
      {catalog.data?.strategy === 'differential' && (
        <Alert color="yellow">
          Differential snapshot: only records captured in this backup window.
        </Alert>
      )}
      {catalog.data?.strategy === 'log' && (
        <Alert color="yellow">
          Change-log snapshot, not a complete database snapshot.
        </Alert>
      )}
      {catalog.isFetching && !catalog.data && (
        <Group role="status">
          <Loader size="sm" />
          <Text size="sm">Reading backup tables...</Text>
          <Button
            variant="subtle"
            size="xs"
            onClick={() => {
              void queryClient.cancelQueries({
                queryKey: ['backup-browse', backup.timestamp],
              });
              setCancelled(true);
            }}
          >
            Cancel
          </Button>
        </Group>
      )}
      {(catalog.error || rows.error || cancelled) && (
        <Alert
          color={cancelled ? 'gray' : 'red'}
          icon={<IconAlertCircle size={18} />}
          title={cancelled ? 'Preview cancelled' : 'Could not load backup data'}
        >
          <Text size="sm">{catalog.error?.message || rows.error?.message}</Text>
          <Button
            mt="xs"
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={retry}
          >
            Retry
          </Button>
        </Alert>
      )}
      {catalog.data && (
        <div className={styles.browser}>
          <Stack gap="xs" className={styles.tableList}>
            <TextInput
              aria-label="Search tables"
              placeholder="Search tables"
              leftSection={<IconSearch size={16} />}
              value={tableSearch}
              onChange={(event) => setTableSearch(event.currentTarget.value)}
            />
            <ScrollArea h={480}>
              {[
                'public',
                'general_merchandise',
                ...catalog.data.tables
                  .map((entry) => entry.schema)
                  .filter(
                    (schema) =>
                      !['public', 'general_merchandise'].includes(schema)
                  ),
              ]
                .filter(
                  (schema, index, values) => values.indexOf(schema) === index
                )
                .map((schema) => {
                  const tables = catalog.data.tables.filter(
                    (entry) =>
                      entry.schema === schema &&
                      entry.key
                        .toLowerCase()
                        .includes(tableSearch.toLowerCase())
                  );
                  return tables.length ? (
                    <Box key={schema} mb="sm">
                      <Text size="xs" c="dimmed" fw={600} mb={4}>
                        {schema === 'public'
                          ? 'Platform / Clothing'
                          : schema.replaceAll('_', ' ')}
                      </Text>
                      {tables.map((entry) => (
                        <NavLink
                          key={entry.key}
                          active={entry.key === table?.key}
                          onClick={() => chooseTable(entry.key)}
                          label={
                            <Text size="xs" truncate>
                              {entry.name}
                            </Text>
                          }
                          rightSection={
                            <Text size="xs" c="dimmed">
                              {entry.count?.toLocaleString() ?? ''}
                            </Text>
                          }
                        />
                      ))}
                    </Box>
                  ) : null;
                })}
              {!catalog.data.tables.some((entry) =>
                entry.key.toLowerCase().includes(tableSearch.toLowerCase())
              ) && (
                <Text size="sm" c="dimmed">
                  No matching tables.
                </Text>
              )}
            </ScrollArea>
          </Stack>
          <Stack gap="sm" style={{ minWidth: 0 }}>
            <Group justify="space-between">
              <Group gap="xs">
                <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
                  {table?.name}
                </Text>
                <Badge
                  size="xs"
                  color={table?.source === 'dump' ? 'teal' : 'blue'}
                >
                  {table?.source}
                </Badge>
              </Group>
              <Group gap={4}>
                <Menu closeOnItemClick={false}>
                  <Menu.Target>
                    <Tooltip label="Visible columns">
                      <ActionIcon variant="subtle" aria-label="Visible columns">
                        <IconColumns size={17} />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {rows.data?.columns.map((column) => (
                      <Menu.Item
                        key={column}
                        onClick={() =>
                          setHidden((values) =>
                            values.includes(column)
                              ? values.filter((value) => value !== column)
                              : [...values, column]
                          )
                        }
                        leftSection={
                          <input
                            type="checkbox"
                            readOnly
                            checked={!hidden.includes(column)}
                            tabIndex={-1}
                            aria-hidden
                          />
                        }
                      >
                        {column}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
                <Tooltip label="Download current page as CSV">
                  <ActionIcon
                    aria-label="Download current page as CSV"
                    variant="subtle"
                    disabled={!rows.data || rows.isFetching}
                    onClick={download}
                  >
                    <IconDownload size={17} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Refresh table">
                  <ActionIcon
                    aria-label="Refresh table"
                    variant="subtle"
                    loading={rows.isFetching}
                    onClick={retry}
                  >
                    <IconRefresh size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <TextInput
              label="Search current page"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            {rows.isFetching && (
              <Group role="status" gap="xs">
                <Loader size="xs" />
                <Text size="xs">Loading rows...</Text>
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconX size={13} />}
                  onClick={() => {
                    void queryClient.cancelQueries({
                      queryKey: ['backup-rows', backup.timestamp],
                    });
                    setCancelled(true);
                  }}
                >
                  Cancel
                </Button>
              </Group>
            )}
            <Box
              className={styles.dataTable}
              style={{ opacity: rows.isPlaceholderData ? 0.5 : 1 }}
            >
              <StandardDataTable
                headers={columns}
                height="440px"
                emptyState={
                  cancelled
                    ? 'Preview cancelled.'
                    : rows.isFetching
                      ? 'Loading rows...'
                      : columns.length === 0 && rows.data?.columns.length
                        ? 'All columns hidden.'
                        : search
                          ? 'No matching rows on this page.'
                          : 'This table is empty.'
                }
              >
                {filtered.length && columns.length
                  ? filtered.map((row, index) => (
                      <Table.Tr key={createRowKey(table?.key ?? 'backup', row)}>
                        <>
                          {columns.map((column, columnIndex) => (
                            <Table.Td
                              key={column}
                              style={{
                                minWidth: 140,
                                maxWidth: 280,
                                textAlign:
                                  typeof row[column] === 'number'
                                    ? 'right'
                                    : 'left',
                              }}
                            >
                              <Tooltip
                                label={formatCellValue(row[column])}
                                multiline
                                maw={400}
                              >
                                <Text size="xs" truncate>
                                  {columnIndex === 0 ? (
                                    <button
                                      className={styles.rowButton}
                                      onClick={() => setDetail(row)}
                                      aria-label={`Open row ${offset + index + 1}`}
                                    >
                                      {formatCellValue(row[column])}
                                    </button>
                                  ) : (
                                    formatCellValue(row[column])
                                  )}
                                </Text>
                              </Tooltip>
                            </Table.Td>
                          ))}
                        </>
                      </Table.Tr>
                    ))
                  : null}
              </StandardDataTable>
            </Box>
            <Group justify="space-between" wrap="wrap">
              <Text size="xs" c="dimmed">
                {rows.data
                  ? `${rows.data.rows.length ? rows.data.offset + 1 : 0}-${rows.data.offset + rows.data.rows.length} of ${rows.data.total?.toLocaleString() ?? (rows.data.hasMore ? `${rows.data.offset + rows.data.rows.length}+` : rows.data.offset + rows.data.rows.length)}`
                  : 'No rows loaded'}
              </Text>
              <Group gap="xs">
                <Select
                  aria-label="Rows per page"
                  w={85}
                  size="xs"
                  data={['100', '250', '500']}
                  value={limit}
                  onChange={(value) => {
                    setLimit(value ?? '250');
                    setOffset(0);
                  }}
                />
                <ActionIcon
                  aria-label="Previous page"
                  variant="default"
                  disabled={!offset || rows.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - Number(limit)))}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <ActionIcon
                  aria-label="Next page"
                  variant="default"
                  disabled={!rows.data?.hasMore || rows.isFetching}
                  onClick={() => setOffset(offset + Number(limit))}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </Stack>
        </div>
      )}
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close row details' }}
        opened={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Row details"
        position="right"
        size="lg"
      >
        <Code
          block
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {JSON.stringify(detail, null, 2)}
        </Code>
      </Drawer>
    </Stack>
  );
}
