import {
  Alert,
  Card,
  Divider,
  Group,
  List,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconBulb, IconInfoCircle } from '@tabler/icons-react';

export function LedgerHelpPanel() {
  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={700} size="lg" c="gray.8">
              Ledger Help
            </Text>
            <Text c="dimmed" size="sm">
              Quick reference for debit/credit and common entries.
            </Text>
          </Stack>
        </Group>

        <Alert
          mt="sm"
          color="blue"
          icon={<IconInfoCircle size={16} />}
          title="Rule of thumb"
        >
          <Text size="sm">
            Debit/credit is not “add/deduct” for everything. It depends on the
            account type.
          </Text>
        </Alert>

        <Divider my="md" />

        <Text fw={600} size="sm" c="gray.8">
          What increases/decreases?
        </Text>

        <Table withTableBorder mt="xs" style={{ tableLayout: 'fixed' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Account Type</Table.Th>
              <Table.Th>Debit</Table.Th>
              <Table.Th>Credit</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>
                <Text size="sm" fw={600}>
                  Asset
                </Text>
                <Text size="xs" c="dimmed">
                  Bank, Cash, Inventory, A/R
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">Increases</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">Decreases</Text>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Text size="sm" fw={600}>
                  Liability
                </Text>
                <Text size="xs" c="dimmed">
                  Loan Payable, A/P, Credit Card Payable
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">Decreases</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">Increases</Text>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>
                <Text size="sm" fw={600}>
                  Equity
                </Text>
                <Text size="xs" c="dimmed">
                  Opening Equity, Owner’s Equity
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">Decreases</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">Increases</Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>

        <Divider my="md" />

        <Text fw={600} size="sm" c="gray.8">
          Common entries
        </Text>

        <List
          spacing="xs"
          size="sm"
          icon={
            <ThemeIcon color="blue" size={18} radius="xl">
              <IconBulb size={12} />
            </ThemeIcon>
          }
          c="gray.7"
          mt="xs"
        >
          <List.Item>
            Customer payment (money in): Debit Bank / Credit Sales Revenue
          </List.Item>
          <List.Item>
            Pay supplier (money out): Debit Expense or Accounts Payable / Credit
            Bank
          </List.Item>
          <List.Item>
            Pay a loan: Debit Loan Payable (principal) + Debit Interest Expense
            (interest) / Credit Bank
          </List.Item>
          <List.Item>
            Transfer (not an expense): Debit E-Wallet / Credit Bank (or Bank /
            Cash)
          </List.Item>
        </List>

        <Divider my="md" />

        <Text fw={600} size="sm" c="gray.8">
          Loan/AP tagging (keeps dropdown clean)
        </Text>
        <Text size="sm" c="dimmed" mt={6}>
          If you pick “Loan Payable” or “Accounts Payable”, you can add a Tag.
          The system will post it as “Loan Payable – &lt;Tag&gt;” or “Accounts
          Payable – &lt;Tag&gt;” so the balance sheet can show per-loan/vendor
          totals without cluttering the account list.
        </Text>
      </Card>
    </Stack>
  );
}
