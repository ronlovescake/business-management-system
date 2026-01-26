'use client';

import { useMemo, useState } from 'react';
import {
  Stack,
  Text,
  TextInput,
  ScrollArea,
  NavLink,
  Badge,
  Group,
  Divider,
} from '@mantine/core';
import { IconSearch, IconTable } from '@tabler/icons-react';
import { useBackupRestoreSidebarStore } from './backupRestoreSidebarStore';

export function BackupRestoreSidebarPanel() {
  const { tables, selectedTable, setSelectedTable } =
    useBackupRestoreSidebarStore();
  const [query, setQuery] = useState('');

  const filteredTables = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return tables;
    }
    return tables.filter((t) => t.name.toLowerCase().includes(trimmed));
  }, [tables, query]);

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <Group justify="space-between" align="center">
        <Group gap={8} align="center">
          <IconTable size={16} />
          <Text size="sm" fw={700}>
            Tables
          </Text>
        </Group>
        <Badge size="xs" variant="light" color="gray">
          {tables.length}
        </Badge>
      </Group>

      <TextInput
        size="sm"
        placeholder="Search tables..."
        leftSection={<IconSearch size={14} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />

      <Divider />

      {tables.length === 0 ? (
        <Text size="sm" c="dimmed">
          Preview a backup to load tables here.
        </Text>
      ) : (
        <ScrollArea style={{ flex: 1 }} offsetScrollbars scrollbarSize={6}>
          <Stack gap={4}>
            {filteredTables.map((table) => (
              <NavLink
                key={table.name}
                label={table.name}
                active={selectedTable === table.name}
                onClick={() => setSelectedTable(table.name)}
                rightSection={
                  <Badge size="xs" variant="light" color="gray">
                    {table.count}
                  </Badge>
                }
                style={{ borderRadius: 8 }}
              />
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}
