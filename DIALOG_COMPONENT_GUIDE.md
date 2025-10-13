# 🎯 Dialog Component - Usage Guide

## 📦 What's Included

A complete, modular dialog/modal system that can be reused across your entire codebase.

### Components Created:

- ✅ `Dialog` - Base dialog component
- ✅ `ComposedDialog` - All-in-one configured dialog
- ✅ `DialogHeader` - Reusable header with icon, subtitle, close button
- ✅ `DialogBody` - Reusable body with scroll support
- ✅ `DialogFooter` - Reusable footer with button configuration
- ✅ Full TypeScript types for all components

### Location:

```
src/components/shared/Dialog/
├── Dialog.tsx              # Main components
├── DialogHeader.tsx        # Header component
├── DialogBody.tsx          # Body component
├── DialogFooter.tsx        # Footer component
├── Dialog.types.ts         # TypeScript definitions
└── index.ts               # Exports
```

---

## 🚀 Usage Examples

### 1️⃣ Simple Dialog (Basic)

Perfect for quick alerts or simple content:

```tsx
import { Dialog } from '@/components/shared/Dialog';

function MyComponent() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button onClick={() => setOpened(true)}>Open Dialog</Button>

      <Dialog
        opened={opened}
        onClose={() => setOpened(false)}
        title="Simple Dialog"
      >
        <Text>This is a simple dialog with just content.</Text>
      </Dialog>
    </>
  );
}
```

---

### 2️⃣ Composed Dialog (Flexible)

Full control with sub-components:

```tsx
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@/components/shared/Dialog';
import { IconPlus } from '@tabler/icons-react';

function AddItemDialog({ opened, onClose, onSave }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(name);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog opened={opened} onClose={onClose} size="lg">
      <DialogHeader
        title="Add New Item"
        subtitle="Fill in the details below"
        icon={<IconPlus size={24} />}
        iconColor="blue"
      />

      <DialogBody padding="md">
        <Stack gap="md">
          <TextInput
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea label="Description" placeholder="Optional details" />
        </Stack>
      </DialogBody>

      <DialogFooter
        secondaryButton={{
          label: 'Cancel',
          onClick: onClose,
          variant: 'default',
        }}
        primaryButton={{
          label: 'Save',
          onClick: handleSave,
          loading: loading,
          disabled: !name,
        }}
      />
    </Dialog>
  );
}
```

---

### 3️⃣ All-in-One ComposedDialog

Configuration-based approach:

```tsx
import { ComposedDialog } from '@/components/shared/Dialog';
import { IconReceipt } from '@tabler/icons-react';

function ExpenseDialog({ opened, onClose, expense, onSave }) {
  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size="lg"
      header={{
        title: expense ? 'Edit Expense' : 'Add New Expense',
        subtitle: 'Manage your expense details',
        icon: <IconReceipt size={24} />,
        iconColor: 'green',
      }}
      body={{
        padding: 'md',
        maxHeight: '60vh', // Scrollable if content is long
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
        },
        primaryButton: {
          label: expense ? 'Update' : 'Add',
          onClick: onSave,
          color: 'green',
        },
      }}
    >
      <Stack gap="md">
        <TextInput label="Date" type="date" required />
        <NumberInput label="Amount" required />
        <TextInput label="Description" required />
        <Select label="Category" data={['Food', 'Travel', 'Supplies']} />
        <Textarea label="Notes" />
      </Stack>
    </ComposedDialog>
  );
}
```

---

### 4️⃣ Confirmation Dialog

Quick confirmation modal:

```tsx
import { Dialog, DialogBody, DialogFooter } from '@/components/shared/Dialog';
import { IconAlertTriangle } from '@tabler/icons-react';

function DeleteConfirmation({ opened, onClose, onConfirm, itemName }) {
  return (
    <Dialog opened={opened} onClose={onClose} size="sm">
      <DialogBody>
        <Group gap="md" align="flex-start">
          <IconAlertTriangle size={32} color="red" />
          <Stack gap="xs">
            <Text fw={600}>Delete {itemName}?</Text>
            <Text size="sm" c="dimmed">
              This action cannot be undone. Are you sure?
            </Text>
          </Stack>
        </Group>
      </DialogBody>

      <DialogFooter
        layout="flex-end"
        secondaryButton={{
          label: 'Cancel',
          onClick: onClose,
        }}
        primaryButton={{
          label: 'Delete',
          onClick: onConfirm,
          color: 'red',
        }}
      />
    </Dialog>
  );
}
```

---

### 5️⃣ Form Dialog with Validation

Complex form with multiple buttons:

```tsx
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@/components/shared/Dialog';
import { IconDeviceFloppy, IconTrash } from '@tabler/icons-react';

function CustomerDialog({ opened, onClose, customer, onSave, onDelete }) {
  const [formData, setFormData] = useState(customer || {});
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Required';
    if (!formData.email) newErrors.email = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <Dialog opened={opened} onClose={onClose} size="xl">
      <DialogHeader
        title={customer ? 'Edit Customer' : 'New Customer'}
        subtitle="Customer information"
      />

      <DialogBody maxHeight="70vh">
        <Stack gap="md">
          <TextInput
            label="Name"
            required
            value={formData.name}
            error={errors.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextInput
            label="Email"
            required
            type="email"
            value={formData.email}
            error={errors.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <TextInput label="Phone" />
          <Textarea label="Address" minRows={3} />
        </Stack>
      </DialogBody>

      <DialogFooter
        layout="space-between"
        additionalButtons={
          customer
            ? [
                {
                  label: 'Delete',
                  onClick: () => onDelete(customer.id),
                  color: 'red',
                  variant: 'light',
                  leftIcon: <IconTrash size={16} />,
                },
              ]
            : []
        }
        secondaryButton={{
          label: 'Cancel',
          onClick: onClose,
        }}
        primaryButton={{
          label: 'Save',
          onClick: handleSave,
          leftIcon: <IconDeviceFloppy size={16} />,
        }}
      />
    </Dialog>
  );
}
```

---

### 6️⃣ Loading Dialog

Show loading state:

```tsx
import { Dialog } from '@/components/shared/Dialog';

function LoadingDialog({ opened, title = 'Processing...' }) {
  return (
    <Dialog
      opened={opened}
      onClose={() => {}} // No close during loading
      title={title}
      loading={true}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
    />
  );
}
```

---

### 7️⃣ Custom Footer Layout

Different button arrangements:

```tsx
// Left-aligned buttons
<DialogFooter
  layout="flex-start"
  primaryButton={{ label: 'Continue', onClick: next }}
/>

// Centered buttons
<DialogFooter
  layout="center"
  secondaryButton={{ label: 'Back', onClick: back }}
  primaryButton={{ label: 'Next', onClick: next }}
/>

// Buttons on opposite sides
<DialogFooter
  layout="space-between"
  secondaryButton={{ label: 'Delete', onClick: del, color: 'red' }}
  primaryButton={{ label: 'Save', onClick: save }}
/>
```

---

## 🎨 Props Reference

### Dialog Props

| Prop                  | Type                                             | Default | Description              |
| --------------------- | ------------------------------------------------ | ------- | ------------------------ |
| `opened`              | `boolean`                                        | -       | Control open/close state |
| `onClose`             | `() => void`                                     | -       | Close handler            |
| `title`               | `ReactNode`                                      | -       | Dialog title             |
| `children`            | `ReactNode`                                      | -       | Dialog content           |
| `size`                | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'`  | Dialog size              |
| `centered`            | `boolean`                                        | `true`  | Center dialog vertically |
| `fullScreen`          | `boolean`                                        | `false` | Full screen on mobile    |
| `closeOnClickOutside` | `boolean`                                        | `true`  | Close on overlay click   |
| `closeOnEscape`       | `boolean`                                        | `true`  | Close on ESC key         |
| `withCloseButton`     | `boolean`                                        | `true`  | Show close button        |
| `loading`             | `boolean`                                        | `false` | Show loading spinner     |
| `padding`             | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'`           | `'lg'`  | Content padding          |

### DialogHeader Props

| Prop              | Type         | Default | Description       |
| ----------------- | ------------ | ------- | ----------------- |
| `title`           | `ReactNode`  | -       | Header title      |
| `subtitle`        | `string`     | -       | Subtitle text     |
| `icon`            | `ReactNode`  | -       | Icon element      |
| `iconColor`       | `string`     | -       | Icon color        |
| `withCloseButton` | `boolean`    | `true`  | Show close button |
| `onClose`         | `() => void` | -       | Close handler     |

### DialogBody Props

| Prop        | Type                                   | Default | Description            |
| ----------- | -------------------------------------- | ------- | ---------------------- |
| `children`  | `ReactNode`                            | -       | Body content           |
| `padding`   | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'`  | Body padding           |
| `maxHeight` | `string \| number`                     | -       | Max height with scroll |

### DialogFooter Props

| Prop                | Type                                                        | Default      | Description           |
| ------------------- | ----------------------------------------------------------- | ------------ | --------------------- |
| `primaryButton`     | `DialogButton`                                              | -            | Primary action button |
| `secondaryButton`   | `DialogButton`                                              | -            | Secondary button      |
| `additionalButtons` | `DialogButton[]`                                            | `[]`         | Extra buttons         |
| `layout`            | `'space-between' \| 'flex-end' \| 'flex-start' \| 'center'` | `'flex-end'` | Button layout         |
| `children`          | `ReactNode`                                                 | -            | Custom footer content |
| `withDivider`       | `boolean`                                                   | `true`       | Show divider above    |

### DialogButton Props

| Prop        | Type                                                        | Default                                        | Description    |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------- | -------------- |
| `label`     | `string`                                                    | -                                              | Button text    |
| `onClick`   | `() => void`                                                | -                                              | Click handler  |
| `color`     | `string`                                                    | -                                              | Button color   |
| `variant`   | `'filled' \| 'light' \| 'outline' \| 'subtle' \| 'default'` | `'filled'` (primary) / `'default'` (secondary) | Button style   |
| `disabled`  | `boolean`                                                   | `false`                                        | Disable button |
| `loading`   | `boolean`                                                   | `false`                                        | Show loading   |
| `leftIcon`  | `ReactNode`                                                 | -                                              | Left icon      |
| `rightIcon` | `ReactNode`                                                 | -                                              | Right icon     |

---

## 🔧 Migration Example

### Before (Old Modal):

```tsx
<Modal
  opened={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Add New Expense"
  size="lg"
>
  <Stack gap="md">
    <TextInput label="Date" type="date" />
    <NumberInput label="Amount" />
    <TextInput label="Description" />

    <Group justify="flex-end" mt="md">
      <Button variant="default" onClick={() => setIsModalOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave}>Add</Button>
    </Group>
  </Stack>
</Modal>
```

### After (New Dialog):

```tsx
<ComposedDialog
  opened={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  header={{
    title: 'Add New Expense',
    icon: <IconReceipt size={24} />,
    iconColor: 'green',
  }}
  footer={{
    secondaryButton: {
      label: 'Cancel',
      onClick: () => setIsModalOpen(false),
    },
    primaryButton: {
      label: 'Add',
      onClick: handleSave,
    },
  }}
  size="lg"
>
  <Stack gap="md">
    <TextInput label="Date" type="date" />
    <NumberInput label="Amount" />
    <TextInput label="Description" />
  </Stack>
</ComposedDialog>
```

---

## ✅ Benefits

1. **🔄 Reusable** - Use across entire codebase
2. **🎨 Consistent** - Same look and feel everywhere
3. **📦 Modular** - Mix and match components
4. **⚡ Flexible** - Simple to complex use cases
5. **🔒 Type-Safe** - Full TypeScript support
6. **🎯 Configurable** - Props for everything
7. **♿ Accessible** - Built on Mantine's Modal
8. **📱 Responsive** - Works on all screen sizes

---

## 🎯 When to Use Which Approach

### Use `Dialog` (Simple):

- Quick alerts
- Single button dialogs
- Custom layouts

### Use `Dialog` + Sub-components (Composed):

- Complex forms
- Multiple sections
- Custom header/footer logic

### Use `ComposedDialog` (All-in-one):

- Standard forms
- CRUD operations
- Consistent patterns

---

## 🚀 Next Steps

1. ✅ Import the Dialog components
2. ✅ Replace existing modals progressively
3. ✅ Customize colors/styles as needed
4. ✅ Add to your component library docs
5. ✅ Share with team

---

**Questions?** Check the examples above or the TypeScript types for full API!
