/**
 * Shipments Module - Edit Shipment Modal Component
 *
 * Modal form for editing existing shipments with 10 pre-populated fields.
 */

import React from 'react';
import {
  Modal,
  Stack,
  Group,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCheck, IconCalendar } from '@tabler/icons-react';
import type { UseFormReturnType } from '@mantine/form';
import type { ShipmentFormData } from '../types/shipment.types';
import { SHIPMENT_STATUS_OPTIONS } from '../types/shipment.types';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

interface EditShipmentModalProps {
  opened: boolean;
  onClose: () => void;
  form: UseFormReturnType<ShipmentFormData>;
  onSubmit: (values: ShipmentFormData) => Promise<void>;
  onOpenTransitBuild?: () => void;
  transitBuildDisabled?: boolean;
}

export const EditShipmentModal = React.memo(function EditShipmentModal({
  opened,
  onClose,
  form,
  onSubmit,
  onOpenTransitBuild,
  transitBuildDisabled,
}: EditShipmentModalProps) {
  const handleSubmit = async (values: ShipmentFormData) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit Shipment"
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Shipment Code"
              placeholder="Enter shipment code"
              required
              {...form.getInputProps('shipmentCode')}
            />
            <TextInput
              label="CV Number"
              placeholder="Enter CV number"
              {...form.getInputProps('cvNumber')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="No. Of Sacks"
              placeholder="Enter number of sacks"
              min={0}
              required
              {...form.getInputProps('noOfSacks')}
            />
            <NumberInput
              label="Total CBM"
              placeholder="Enter total CBM"
              min={0}
              decimalScale={2}
              required
              {...form.getInputProps('totalCBM')}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Weight (kg)"
              placeholder="Enter weight"
              min={0}
              decimalScale={2}
              required
              {...form.getInputProps('weight')}
            />
            <NumberInput
              label="Fee (₱)"
              placeholder="Enter fee"
              min={0}
              decimalScale={2}
              required
              {...form.getInputProps('fee')}
            />
          </Group>

          <Select
            label="Shipment Status"
            placeholder="Select status"
            required
            data={[...SHIPMENT_STATUS_OPTIONS]}
            {...form.getInputProps('shipmentStatus')}
          />

          <Group grow>
            <DateInput
              label="Date Created"
              placeholder="Select date created"
              leftSection={<IconCalendar size={16} />}
              required
              {...COMMON_DATE_INPUT_PROPS}
              {...form.getInputProps('dateCreated')}
            />
            <DateInput
              label="Date Delivered"
              placeholder="Select date delivered"
              leftSection={<IconCalendar size={16} />}
              {...COMMON_DATE_INPUT_PROPS}
              {...form.getInputProps('dateDelivered')}
            />
          </Group>

          <Textarea
            label="Notes"
            placeholder="Enter any additional notes..."
            rows={3}
            {...form.getInputProps('notes')}
          />

          <Group justify="flex-end" mt="md">
            {onOpenTransitBuild && (
              <Button
                type="button"
                variant="light"
                color="orange"
                onClick={onOpenTransitBuild}
                disabled={transitBuildDisabled}
              >
                Transit Build-Up
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              leftSection={<IconCheck size={16} />}
            >
              Update Shipment
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
});
