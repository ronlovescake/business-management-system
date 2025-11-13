'use client';

/**
 * SettingsPage Component
 *
 * Main settings page with tabs for marketplace, installed modules, updates, and dependencies
 */

import { useState } from 'react';
import { Container, Title, Tabs, Paper } from '@mantine/core';
import {
  IconDatabase,
  IconFileInvoice,
  IconMessage,
  IconTable,
} from '@tabler/icons-react';
import { BackupRestoreTab } from './BackupRestoreTab';
import { InvoiceSettingsTab } from './InvoiceSettingsTab';
import InvoiceMessageTab from './InvoiceMessageTab';
import { TransactionsSettingsTab } from './TransactionsSettingsTab';
import type { SettingsTab } from '../types';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('invoice');

  return (
    <Container size="100%" px="xl" py="xl" style={{ maxWidth: '100%' }}>
      <Title order={1} mb="xl">
        Settings
      </Title>

      <Paper 
        shadow="sm" 
        p="md" 
        radius="md"
        style={{ height: '86vh', overflow: 'auto' }}
      >
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as SettingsTab)}
        >
          <Tabs.List>
            <Tabs.Tab
              value="invoice"
              leftSection={<IconFileInvoice size={16} />}
            >
              Invoice Settings
            </Tabs.Tab>
            <Tabs.Tab value="message" leftSection={<IconMessage size={16} />}>
              Invoice Message
            </Tabs.Tab>
            <Tabs.Tab
              value="transactions"
              leftSection={<IconTable size={16} />}
            >
              Transactions
            </Tabs.Tab>
            <Tabs.Tab value="backup" leftSection={<IconDatabase size={16} />}>
              Backup & Restore
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="invoice" pt="md">
            <InvoiceSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="message" pt="md">
            <InvoiceMessageTab />
          </Tabs.Panel>

          <Tabs.Panel value="transactions" pt="md">
            <TransactionsSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="backup" pt="md">
            <BackupRestoreTab />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
