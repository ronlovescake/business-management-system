/**
 * Example: Simple Confirmation Dialog
 *
 * A reusable confirmation dialog for delete actions or other confirmations.
 */

import { Text, Group, Stack } from '@mantine/core';
import { IconAlertTriangle, IconTrash, IconCheck } from '@tabler/icons-react';
import { Dialog, DialogBody, DialogFooter } from '@/components/shared/Dialog';

interface ConfirmationDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmationDialog({
  opened,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'danger',
  loading = false,
}: ConfirmationDialogProps) {
  const config = {
    danger: {
      icon: <IconTrash size={32} />,
      color: 'red',
    },
    warning: {
      icon: <IconAlertTriangle size={32} />,
      color: 'orange',
    },
    info: {
      icon: <IconCheck size={32} />,
      color: 'blue',
    },
  };

  const { icon, color } = config[type];

  return (
    <Dialog opened={opened} onClose={onClose} size="sm" centered>
      <DialogBody>
        <Group gap="md" align="flex-start">
          <div style={{ color }}>{icon}</div>
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600} size="lg">
              {title}
            </Text>
            <Text size="sm" c="dimmed">
              {message}
            </Text>
          </Stack>
        </Group>
      </DialogBody>

      <DialogFooter
        layout="flex-end"
        secondaryButton={{
          label: cancelLabel,
          onClick: onClose,
          variant: 'default',
        }}
        primaryButton={{
          label: confirmLabel,
          onClick: onConfirm,
          color: color,
          loading: loading,
        }}
      />
    </Dialog>
  );
}

// Usage example:
/*
function MyComponent() {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    await deleteItem();
    setDeleteOpen(false);
  };

  return (
    <>
      <Button color="red" onClick={() => setDeleteOpen(true)}>
        Delete Item
      </Button>

      <ConfirmationDialog
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Item?"
        message="This item will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        type="danger"
      />
    </>
  );
}
*/
