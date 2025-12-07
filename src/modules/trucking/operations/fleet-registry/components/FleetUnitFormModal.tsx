import {
  Modal,
  Stack,
  Group,
  TextInput,
  Select,
  Textarea,
  NumberInput,
  Button,
  Divider,
  Title,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDidUpdate } from '@mantine/hooks';
import type {
  FleetUnitFormValues,
  FleetStatus,
} from '../types/fleetRegistry.types';

interface FleetUnitFormModalProps {
  opened: boolean;
  initialValues: FleetUnitFormValues;
  onClose: () => void;
  onSubmit: (values: FleetUnitFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
}

const fuelOptions = ['Diesel', 'Gasoline', 'Hybrid', 'Electric'];
const statusOptions: { label: string; value: FleetStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Retired', value: 'retired' },
];

export function FleetUnitFormModal({
  opened,
  initialValues,
  onClose,
  onSubmit,
  isSubmitting = false,
}: FleetUnitFormModalProps) {
  const form = useForm<FleetUnitFormValues>({
    initialValues,
    validate: {
      truckId: (value) =>
        value.trim().length === 0 ? 'Truck ID is required' : null,
      maker: (value) =>
        value.trim().length === 0 ? 'Maker is required' : null,
      model: (value) =>
        value.trim().length === 0 ? 'Model is required' : null,
      year: (value) => (value.trim().length === 0 ? 'Year is required' : null),
      plateNo: (value) =>
        value.trim().length === 0 ? 'Plate number is required' : null,
      fuelType: (value) =>
        value.trim().length === 0 ? 'Fuel type is required' : null,
      ltoRegisterDate: (value) =>
        value.trim().length === 0 ? 'LTO register date is required' : null,
    },
  });

  useDidUpdate(() => {
    if (!opened) {
      return;
    }

    form.setValues(initialValues);
    form.resetDirty(initialValues);
  }, [opened, initialValues]);

  const handleSubmit = form.onSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="80rem"
      title={
        <Title order={3} ta="center" w="100%">
          Add Fleet Unit
        </Title>
      }
      radius="lg"
      padding="xl"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Stack gap="xs">
            <Title order={4}>Basic Information</Title>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <TextInput
                label="Truck ID"
                placeholder="TRK-001"
                withAsterisk
                {...form.getInputProps('truckId')}
              />
              <TextInput
                label="Maker"
                placeholder="Isuzu"
                withAsterisk
                {...form.getInputProps('maker')}
              />
              <TextInput
                label="Model"
                placeholder="N-Series"
                withAsterisk
                {...form.getInputProps('model')}
              />
              <NumberInput
                label="Model Year"
                min={1990}
                max={2100}
                clampBehavior="strict"
                value={Number(form.values.year) || undefined}
                onChange={(value) =>
                  form.setFieldValue('year', value ? String(value) : '')
                }
              />
              <TextInput
                label="Plate Number"
                placeholder="ABC-1234"
                withAsterisk
                {...form.getInputProps('plateNo')}
              />
              <TextInput
                label="Body Number"
                placeholder="B-1001"
                {...form.getInputProps('bodyNo')}
              />
              <TextInput
                label="Chassis Number"
                placeholder="CHS-001-XYZ"
                {...form.getInputProps('chassisNo')}
              />
              <TextInput
                label="Engine Number"
                placeholder="ENG-5678-A"
                {...form.getInputProps('engineNo')}
              />
              <TextInput
                label="Capacity"
                placeholder="4.5T"
                {...form.getInputProps('capacity')}
              />
            </SimpleGrid>
          </Stack>

          <Divider label="Registration & Status" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <TextInput
              label="LTO Register Date"
              type="date"
              withAsterisk
              {...form.getInputProps('ltoRegisterDate')}
            />
            <TextInput
              label="OR/CR Info"
              placeholder="OR-2025-0001"
              {...form.getInputProps('orCrInfo')}
            />
            <Select
              label="Fuel Type"
              data={fuelOptions}
              placeholder="Select fuel"
              withAsterisk
              {...form.getInputProps('fuelType')}
            />
            <Select
              label="Status"
              data={statusOptions}
              placeholder="Select status"
              {...form.getInputProps('status')}
            />
            <Select
              label="Ownership"
              data={['Company-owned', 'Leased']}
              {...form.getInputProps('ownershipType')}
            />
            <TextInput
              label="Acquisition Date"
              type="date"
              {...form.getInputProps('acquisitionDate')}
            />
          </SimpleGrid>

          <Divider label="Financial & Compliance" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <TextInput
              label="Purchase Cost (₱)"
              placeholder="1500000"
              {...form.getInputProps('purchaseCost')}
            />
            <TextInput
              label="Insurance Provider"
              placeholder="Allied Insurance"
              {...form.getInputProps('insuranceProvider')}
            />
            <TextInput
              label="Insurance Expiry"
              type="date"
              {...form.getInputProps('insuranceExpiry')}
            />
          </SimpleGrid>

          <Divider label="Assignments & Tracking" labelPosition="left" />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <TextInput
              label="GPS Tracker ID"
              placeholder="TRK-001-GPS"
              {...form.getInputProps('gpsTrackerId')}
            />
            <TextInput
              label="Depot Location"
              placeholder="Meycauayan Yard"
              {...form.getInputProps('depotLocation')}
            />
            <TextInput
              label="Assigned Driver"
              placeholder="Jonas Velasco"
              {...form.getInputProps('driverAssigned')}
            />
          </SimpleGrid>

          <Textarea
            label="Remarks"
            minRows={3}
            placeholder="Special notes, maintenance reminders, or compliance details"
            {...form.getInputProps('remarks')}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Add Unit
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
