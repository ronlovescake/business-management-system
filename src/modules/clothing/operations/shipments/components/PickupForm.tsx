/**
 * Pickup Form Component
 *
 * Displays pickup information dashboard and shipment details table
 * Shows only shipments with "For Pickup" status
 */

'use client';

import { useMemo } from 'react';
import { Stack, Card, Text, Group, Table, Title, Button } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconUser,
  IconBarcode,
  IconContainer,
  IconPackage,
  IconCurrencyPeso,
  IconBox,
  IconScale,
  IconCopy,
} from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';
import type { ShipmentData } from '../types/shipment.types';

interface PickupFormProps {
  shipments: ShipmentData[];
}

interface PickupFormData {
  completeName: string;
  kpcCode: string;
  containerNumber: string;
  howManySacks: number;
  totalShipmentFee: number;
  totalCBM: number;
  totalWeight: number;
}

export function PickupForm({ shipments }: PickupFormProps) {
  // Filter shipments with "For Pickup" status
  const forPickupShipments = useMemo(() => {
    return shipments.filter(
      (shipment) => shipment['Shipment Status'] === 'For Pickup'
    );
  }, [shipments]);

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    const notifySuccess = () => {
      showNotification({
        title: 'Copied!',
        message: `${label} copied to clipboard`,
        color: 'green',
        position: 'top-right',
        autoClose: 2000,
      });
    };

    const notifyFailure = () => {
      showNotification({
        title: 'Failed to copy',
        message: 'Please try again',
        color: 'red',
        position: 'top-right',
        autoClose: 2000,
      });
    };

    const legacyCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        notifySuccess();
        return;
      }

      if (legacyCopy()) {
        notifySuccess();
        return;
      }

      notifyFailure();
    } catch (err) {
      if (legacyCopy()) {
        notifySuccess();
        return;
      }
      notifyFailure();
    }
  };

  // Calculate totals from filtered shipments
  const calculatedData = useMemo(() => {
    const totals = {
      howManySacks: 0,
      totalShipmentFee: 0,
      totalCBM: 0,
      totalWeight: 0,
    };

    forPickupShipments.forEach((shipment) => {
      totals.howManySacks += Number(shipment['No. Of Sacks']) || 0;
      totals.totalShipmentFee += Number(shipment['Fee']) || 0;
      totals.totalCBM += Number(shipment['Total CBM']) || 0;
      totals.totalWeight += Number(shipment['Weight']) || 0;
    });

    return totals;
  }, [forPickupShipments]);

  // Get unique CV Numbers
  const containerNumbers = useMemo(() => {
    const uniqueCVs = new Set(
      forPickupShipments
        .map((shipment) => shipment['CV Number'])
        .filter((cv) => cv && cv.trim() !== '')
    );
    return Array.from(uniqueCVs).join(', ');
  }, [forPickupShipments]);

  // Merge static and calculated data
  const formData: PickupFormData = {
    completeName: 'CZARINA C. BALNIG',
    kpcCode: 'KPC 23930A',
    containerNumber: containerNumbers,
    howManySacks: calculatedData.howManySacks,
    totalShipmentFee: calculatedData.totalShipmentFee,
    totalCBM: calculatedData.totalCBM,
    totalWeight: calculatedData.totalWeight,
  };

  const pickupMessage = `PROVIDE THESE DETAILS AT THE PICKUP LOCATION:

Complete Name: ${formData.completeName}
KPC Code: ${formData.kpcCode}

CV Number:
${formData.containerNumber || '-'}

No. Of Sacks: ${formData.howManySacks.toLocaleString()}
Total CBM: ${formData.totalCBM.toFixed(2)}
Weight: ${formData.totalWeight.toLocaleString()} kg`;

  return (
    <Stack gap="lg">
      {/* Dashboard Section */}
      <Group align="stretch" gap="xl">
        {/* Left Side - Customer Information */}
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ flex: 1, minWidth: 0, height: '100%' }}
        >
          <Stack gap="md">
            <Title order={4} mb="xs">
              Customer Information
            </Title>

            {/* Complete Name */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() => copyToClipboard('CZARINA C. BALNIG', 'Name')}
            >
              <IconUser size={20} color="var(--mantine-color-blue-6)" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  Complete Name
                </Text>
                <Text size="md" fw={700}>
                  CZARINA C. BALNIG
                </Text>
              </div>
            </Group>

            {/* KPC Code */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() => copyToClipboard('KPC 23930A', 'KPC Code')}
            >
              <IconBarcode size={20} color="var(--mantine-color-indigo-6)" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  KPC Code
                </Text>
                <Text size="md" fw={700}>
                  KPC 23930A
                </Text>
              </div>
            </Group>

            {/* Container Number (CV) */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() =>
                copyToClipboard(
                  formData.containerNumber || '-',
                  'Container Number'
                )
              }
            >
              <IconContainer size={20} color="var(--mantine-color-cyan-6)" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  Container Number (CV)
                </Text>
                <Text size="md" fw={700}>
                  {formData.containerNumber || '-'}
                </Text>
              </div>
            </Group>

            {/* How Many Sacks */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() =>
                copyToClipboard(
                  formData.howManySacks.toString(),
                  'Number of Sacks'
                )
              }
            >
              <IconPackage size={20} color="var(--mantine-color-orange-6)" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  How Many Sacks?
                </Text>
                <Text size="md" fw={700}>
                  {formData.howManySacks.toLocaleString()}
                </Text>
              </div>
            </Group>

            {/* Total Shipment Fee */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() =>
                copyToClipboard(
                  formData.totalShipmentFee.toString(),
                  'Total Shipment Fee'
                )
              }
            >
              <IconCurrencyPeso
                size={20}
                color="var(--mantine-color-purple-6)"
              />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  Total Shipment Fee
                </Text>
                <Text size="md" fw={700}>
                  ₱{formData.totalShipmentFee.toLocaleString()}
                </Text>
              </div>
            </Group>

            {/* Total CBM */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() =>
                copyToClipboard(formData.totalCBM.toFixed(2), 'Total CBM')
              }
            >
              <IconBox size={20} color="var(--mantine-color-teal-6)" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  Total CBM
                </Text>
                <Text size="md" fw={700}>
                  {formData.totalCBM.toFixed(2)} m³
                </Text>
              </div>
            </Group>

            {/* Total Weight */}
            <Group
              gap="xs"
              style={{ cursor: 'pointer' }}
              onClick={() =>
                copyToClipboard(formData.totalWeight.toString(), 'Total Weight')
              }
            >
              <IconScale size={20} color="var(--mantine-color-indigo-6)" />
              <div>
                <Text size="xs" c="dimmed" fw={500}>
                  Total Weight
                </Text>
                <Text size="md" fw={700}>
                  {formData.totalWeight.toLocaleString()} kg
                </Text>
              </div>
            </Group>
          </Stack>
        </Card>

        {/* Right Side - Message Card */}
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ flex: 1, minWidth: 0 }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Title order={4}>Pickup Message</Title>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconCopy size={14} />}
                onClick={() => copyToClipboard(pickupMessage, 'Pickup Message')}
              >
                Copy
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              PLEASE FOLLOW THE PINNED ADDRESS (PICKUP POINT / DROP OFF POINT)
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
              {pickupMessage}
            </Text>
          </Stack>
        </Card>
      </Group>

      {/* Shipments Table */}
      <div>
        <StandardTableContainer
          summary={
            <div
              style={{
                display: 'flex',
                width: '100%',
                textAlign: 'center',
              }}
            >
              {/* Shipment Code column - empty for alignment */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}></div>

              {/* CV Number column - empty for alignment */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}></div>

              {/* No. Of Sacks column */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Text size="xs" c="dimmed" fw={500}>
                  Total Sacks
                </Text>
                <Text size="lg" fw={700}>
                  {calculatedData.howManySacks.toLocaleString()}
                </Text>
              </div>

              {/* Total CBM column */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Text size="xs" c="dimmed" fw={500}>
                  Total CBM
                </Text>
                <Text size="lg" fw={700}>
                  {calculatedData.totalCBM.toFixed(2)} m³
                </Text>
              </div>

              {/* Weight column */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Text size="xs" c="dimmed" fw={500}>
                  Total Weight
                </Text>
                <Text size="lg" fw={700}>
                  {calculatedData.totalWeight.toLocaleString()} kg
                </Text>
              </div>

              {/* Fee column */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <Text size="xs" c="dimmed" fw={500}>
                  Total Fee
                </Text>
                <Text size="lg" fw={700}>
                  ₱{calculatedData.totalShipmentFee.toLocaleString()}
                </Text>
              </div>
            </div>
          }
        >
          <StandardDataTable
            headers={[
              'Shipment Code',
              'CV Number',
              'No. Of Sacks',
              'Total CBM',
              'Weight',
              'Fee',
            ]}
            height="54vh"
            emptyState="No shipments with 'For Pickup' status found."
            colSpan={6}
          >
            {forPickupShipments.map((shipment) => (
              <Table.Tr key={shipment.id}>
                <Table.Td style={{ textAlign: 'center' }}>
                  {shipment['Shipment Code']}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {shipment['CV Number']}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {Number(shipment['No. Of Sacks']).toLocaleString()}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {Number(shipment['Total CBM']).toFixed(2)} m³
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {Number(shipment['Weight']).toLocaleString()} kg
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  ₱{Number(shipment['Fee']).toLocaleString()}
                </Table.Td>
              </Table.Tr>
            ))}
          </StandardDataTable>
        </StandardTableContainer>
      </div>
    </Stack>
  );
}
