import { memo } from 'react';
import {
  Paper,
  SimpleGrid,
  Stack,
  Title,
  Flex,
  Text,
  NumberInput,
  Select,
} from '@mantine/core';

interface ShippingCalculatorCardProps {
  actualAlibabaShipping: number | string;
  actualForwardersFee: number | string;
  actualLalamove: number | string;
  onAlibabaChange: (value: string | number) => void;
  onForwardersChange: (value: string | number) => void;
  onLalamoveChange: (value: string | number) => void;
  shipmentCodes: string[];
  selectedShipmentCode: string | null;
  onShipmentCodeChange: (value: string | null) => void;
}

export const ShippingCalculatorCard = memo(
  ({
    actualAlibabaShipping,
    actualForwardersFee,
    actualLalamove,
    onAlibabaChange,
    onForwardersChange,
    onLalamoveChange,
    shipmentCodes,
    selectedShipmentCode,
    onShipmentCodeChange,
  }: ShippingCalculatorCardProps) => {
    return (
      <Paper withBorder p="xl" radius="md">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="md">
            <Title order={4} c="dimmed">
              ACTUAL SHIPPING FEES
            </Title>

            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 200 }} fw={500}>
                Alibaba Shipping Cost
              </Text>
              <NumberInput
                placeholder="Enter amount"
                value={actualAlibabaShipping}
                onChange={onAlibabaChange}
                prefix="₱"
                thousandSeparator=","
                decimalScale={2}
                fixedDecimalScale
                size="md"
                style={{ flex: 1 }}
              />
            </Flex>

            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 200 }} fw={500}>
                Forwarder&apos;s Fee (KPC)
              </Text>
              <NumberInput
                placeholder="Enter amount"
                value={actualForwardersFee}
                onChange={onForwardersChange}
                prefix="₱"
                thousandSeparator=","
                decimalScale={2}
                fixedDecimalScale
                size="md"
                style={{ flex: 1 }}
              />
            </Flex>

            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 200 }} fw={500}>
                Lalamove
              </Text>
              <NumberInput
                placeholder="Enter amount"
                value={actualLalamove}
                onChange={onLalamoveChange}
                prefix="₱"
                thousandSeparator=","
                decimalScale={2}
                fixedDecimalScale
                size="md"
                style={{ flex: 1 }}
              />
            </Flex>
          </Stack>

          <Stack gap="md" justify="flex-start">
            <Title order={4} c="dimmed">
              SHIPMENT CODE DETAILS
            </Title>
            <Flex gap="md" align="center">
              <Text w={{ base: 140, md: 220 }} fw={500}>
                Select Shipment Code
              </Text>
              <Select
                placeholder="Choose a shipment code"
                data={shipmentCodes}
                value={selectedShipmentCode}
                onChange={onShipmentCodeChange}
                searchable
                clearable
                size="md"
                maxDropdownHeight={400}
                style={{ flex: 1 }}
              />
            </Flex>
          </Stack>
        </SimpleGrid>
      </Paper>
    );
  }
);

ShippingCalculatorCard.displayName = 'ShippingCalculatorCard';
