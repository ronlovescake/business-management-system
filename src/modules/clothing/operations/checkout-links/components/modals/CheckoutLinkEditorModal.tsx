import { Stack, Group, TextInput, Button } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { CheckoutLinkFormValues } from '../../types';
import { UniversalModal } from '@/components/modals/UniversalModal';

interface CheckoutLinkEditorModalProps {
  opened: boolean;
  onClose: () => void;
  form: UseFormReturnType<CheckoutLinkFormValues>;
  onSubmit: (values: CheckoutLinkFormValues) => void | Promise<void>;
  isSaving: boolean;
}

export function CheckoutLinkEditorModal({
  opened,
  onClose,
  form,
  onSubmit,
  isSaving,
}: CheckoutLinkEditorModalProps) {
  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title="Edit Checkout Link"
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Weight"
              placeholder="e.g. 1kg"
              required
              disabled={isSaving}
              {...form.getInputProps('weight')}
            />
            <TextInput
              label="Width"
              placeholder="e.g. 10cm"
              required
              disabled={isSaving}
              {...form.getInputProps('width')}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Length"
              placeholder="e.g. 15cm"
              required
              disabled={isSaving}
              {...form.getInputProps('length')}
            />
            <TextInput
              label="Height"
              placeholder="e.g. 5cm"
              required
              disabled={isSaving}
              {...form.getInputProps('height')}
            />
          </Group>
          <TextInput
            label="Checkout Links"
            placeholder="https://..."
            disabled={isSaving}
            {...form.getInputProps('checkoutLinks')}
          />
          <TextInput
            label="Product Portals"
            placeholder="https://..."
            disabled={isSaving}
            {...form.getInputProps('productPortals')}
          />
          <TextInput
            label="Product Names"
            placeholder="Enter product names"
            disabled={isSaving}
            {...form.getInputProps('productNames')}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </form>
    </UniversalModal>
  );
}
