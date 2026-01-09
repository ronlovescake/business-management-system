'use client';

import { Card, List, Stack, Text } from '@mantine/core';
import { PersonalPageShell } from '../components/PersonalPageShell';

export default function PersonalAccountsPage() {
  return (
    <PersonalPageShell
      title="Accounts"
      description="Manage bank accounts, wallets, credit cards, and cash envelopes."
    >
      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Planned capabilities</Text>
          <List spacing={6} size="sm">
            <List.Item>Account balances and reconciliation</List.Item>
            <List.Item>
              Account types: checking, savings, credit, cash
            </List.Item>
            <List.Item>Transfer tracking between accounts</List.Item>
            <List.Item>Net worth calculation rollups</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            This page is scaffolded and ready for data integration.
          </Text>
        </Stack>
      </Card>
    </PersonalPageShell>
  );
}
