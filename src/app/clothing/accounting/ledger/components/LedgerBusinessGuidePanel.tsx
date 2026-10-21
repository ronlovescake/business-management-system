import { Accordion, Alert, Button, List, Stack, Text } from '@mantine/core';
import {
  CLOTHING_ENTRY_SCENARIOS,
  type ClothingManualEntryPresetId,
} from '../ledgerEntryGuidance';

type LedgerBusinessGuidePanelProps = {
  onStartEntry: (scenarioId: ClothingManualEntryPresetId) => void;
};

export function LedgerBusinessGuidePanel({
  onStartEntry,
}: LedgerBusinessGuidePanelProps) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text fw={700} size="lg">
          Clothing Business Guide
        </Text>
        <Text size="sm" c="dimmed">
          Choose the workflow that matches what happened. Check the ledger
          before recording anything a second time.
        </Text>
      </Stack>

      <Alert color="blue" title="Usually recorded by another workflow">
        Sales Revenue, Sales Returns, Customer Deposits, Forfeited Deposits,
        COGS, and Payroll come from transaction, refund, inventory, or payroll
        records. Inventory Shrinkage is calculated for reporting from inventory
        movements; it is not the account used by the current shrinkage journal
        calculation. Use those business workflows instead of adding a routine
        manual entry here.
      </Alert>

      <Alert color="gray" title="Use the dedicated ledger workflows">
        Stock on Hand and Inventory in Transit use Products and shipment
        reclassification. Landed Cost Clearing and forwarder or courier payables
        use Shipments → Logistics Costs. Opening Equity belongs in the Opening
        Balance tab, not an ordinary manual entry.
      </Alert>

      <Accordion variant="default">
        {CLOTHING_ENTRY_SCENARIOS.map((scenario) => (
          <Accordion.Item key={scenario.id} value={scenario.id}>
            <Accordion.Control>{scenario.title}</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <Text size="sm">
                  <Text span fw={600}>
                    When to use:
                  </Text>
                  {scenario.when}
                </Text>
                <List type="ordered" size="sm" spacing="xs">
                  {scenario.steps.map((step) => (
                    <List.Item key={step}>{step}</List.Item>
                  ))}
                </List>
                <Text size="sm">
                  <Text span fw={600}>
                    Example:
                  </Text>
                  {scenario.example}
                </Text>
                {scenario.warning && (
                  <Alert color="yellow">{scenario.warning}</Alert>
                )}
                {scenario.debitAccount && scenario.creditAccount && (
                  <Button
                    size="sm"
                    variant="light"
                    onClick={() =>
                      onStartEntry(scenario.id as ClothingManualEntryPresetId)
                    }
                  >
                    Start guided entry
                  </Button>
                )}
                {scenario.destination && (
                  <Button
                    component="a"
                    href={scenario.destination.href}
                    size="sm"
                    variant="light"
                  >
                    {scenario.destination.label}
                  </Button>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      <Alert color="teal" title="When a loan payment includes interest">
        Example: a ₱12,000 payment is ₱10,000 principal plus ₱2,000 interest.
        Save two separate entries using the same payment reference: principal
        debits Loan Payable; interest debits Interest Expense. Each entry
        credits Cash for its own amount, so total Cash credited is ₱12,000.
      </Alert>

      <Text size="sm" c="dimmed">
        Cash combines cash, bank, and GCash. A payment that includes loan
        principal and interest needs two entries: the principal amount and the
        interest amount must add up to the actual amount paid. Do not count
        principal as an expense.
      </Text>
    </Stack>
  );
}
