'use client';

/**
 * SettingsPage Component
 *
 * Main settings page with tabs for marketplace, installed modules, updates, and dependencies
 */

import React, { useState } from 'react';
import {
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Tabs,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconCalendar,
  IconFileInvoice,
  IconHistory,
  IconMessage,
  IconSearch,
  IconTable,
} from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { ChangeLogPage } from '@/modules/clothing/operations/settings/change-log';
import { AccountingSettingsTab } from './AccountingSettingsTab';
import { InvoiceSettingsTab } from './InvoiceSettingsTab';
import InvoiceMessageTab, { type TemplateSubTab } from './InvoiceMessageTab';
import { TransactionsSettingsTab } from './TransactionsSettingsTab';
import type { SettingsTab } from '../types';

const QUICK_ACTION_BUTTONS: Array<{
  id: string;
  label: string;
  tab?: SettingsTab;
}> = [
  { id: 'change-log', label: 'Change Log', tab: 'change-log' },
  { id: 'invoice-settings', label: 'Invoice Settings', tab: 'invoice' },
  { id: 'invoice-message', label: 'Templates', tab: 'message' },
  { id: 'transactions', label: 'Transactions', tab: 'transactions' },
  { id: 'accounting', label: 'Accounting', tab: 'accounting' },
];

interface SettingsPageProps {
  apiBasePath?: string;
}

export function SettingsPage({ apiBasePath }: SettingsPageProps) {
  const searchParams = useSearchParams();
  const getInitialTab = () => {
    const param = searchParams?.get('tab');
    const validTabs: SettingsTab[] = [
      'invoice',
      'message',
      'transactions',
      'accounting',
      'change-log',
    ];

    return validTabs.includes(param as SettingsTab)
      ? (param as SettingsTab)
      : 'change-log';
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    getInitialTab()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const templateSubTabParam = searchParams?.get('subTab');
  const templateSubTabs: TemplateSubTab[] = [
    'invoice',
    'message-templates',
    'post-templates',
  ];
  const initialTemplateSubTab = templateSubTabs.includes(
    templateSubTabParam as TemplateSubTab
  )
    ? (templateSubTabParam as TemplateSubTab)
    : 'invoice';
  const changeLogFiltersEnabled = activeTab === 'change-log';

  const isDateRangeValid = !startDate || !endDate || endDate >= startDate;

  return (
    <Container size="100%" px="xl" py="xl" style={{ maxWidth: '100%' }}>
      <Stack gap="md">
        <Paper withBorder shadow="xs" p="md" radius="md">
          <Group gap="sm" wrap="nowrap" align="center">
            <TextInput
              placeholder={
                changeLogFiltersEnabled
                  ? 'Search customer, product code, invoice, or notes...'
                  : 'Open Change Log to search entries'
              }
              aria-label="Search change log"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              leftSection={<IconSearch size={16} stroke={1.5} />}
              radius="md"
              style={{ flex: 1 }}
              disabled={!changeLogFiltersEnabled}
            />

            <Group gap="xs" wrap="nowrap">
              <DateInput
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
                aria-label="Filter start date"
                disabled={!changeLogFiltersEnabled}
                {...COMMON_DATE_INPUT_PROPS}
                error={
                  isDateRangeValid ? undefined : 'Start must be before end'
                }
              />
              <DateInput
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                aria-label="Filter end date"
                minDate={startDate ?? undefined}
                disabled={!changeLogFiltersEnabled}
                {...COMMON_DATE_INPUT_PROPS}
                error={isDateRangeValid ? undefined : 'End must be after start'}
              />
            </Group>

            <Group gap="xs" wrap="nowrap">
              {QUICK_ACTION_BUTTONS.map((button) => {
                const isActive = button.tab ? activeTab === button.tab : false;

                return (
                  <Button
                    key={button.id}
                    variant={isActive ? 'filled' : 'outline'}
                    color="blue"
                    radius="md"
                    fw={500}
                    style={{ minWidth: '5rem' }}
                    onClick={() => {
                      if (button.tab) {
                        setActiveTab(button.tab);
                      }
                    }}
                    data-active={isActive || undefined}
                  >
                    {button.label}
                  </Button>
                );
              })}
            </Group>
          </Group>
        </Paper>

        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as SettingsTab)}
        >
          <Tabs.List style={{ display: 'none' }} aria-hidden="true">
            <Tabs.Tab
              value="invoice"
              leftSection={<IconFileInvoice size={16} />}
            >
              Invoice Settings
            </Tabs.Tab>
            <Tabs.Tab value="message" leftSection={<IconMessage size={16} />}>
              Templates
            </Tabs.Tab>
            <Tabs.Tab
              value="transactions"
              leftSection={<IconTable size={16} />}
            >
              Transactions
            </Tabs.Tab>
            <Tabs.Tab
              value="accounting"
              leftSection={<IconCalendar size={16} />}
            >
              Accounting
            </Tabs.Tab>
            <Tabs.Tab
              value="change-log"
              leftSection={<IconHistory size={16} />}
            >
              Change Log
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="invoice" pt="md">
            <InvoiceSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="message" pt="md">
            <InvoiceMessageTab
              initialSubTab={initialTemplateSubTab}
              apiBasePath={apiBasePath}
            />
          </Tabs.Panel>

          <Tabs.Panel value="transactions" pt="md">
            <TransactionsSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="accounting" pt="md">
            <AccountingSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="change-log" pt="md">
            <ChangeLogPage
              hideFilters
              externalSearch={searchQuery}
              externalStartDate={startDate}
              externalEndDate={endDate}
              apiBasePath={apiBasePath}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
