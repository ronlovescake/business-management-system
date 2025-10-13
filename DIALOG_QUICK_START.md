# 🚀 Dialog Component - Quick Start Card

> **Copy this to your desk/monitor for quick reference!**

---

## Import

```tsx
import { ComposedDialog } from '@/components/shared/Dialog';
import { IconReceipt } from '@tabler/icons-react';
```

---

## Basic Usage

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{
    title: 'Add Item',
    icon: <IconReceipt size={24} />,
    iconColor: 'blue',
  }}
  footer={{
    secondaryButton: {
      label: 'Cancel',
      onClick: onClose,
    },
    primaryButton: {
      label: 'Save',
      onClick: onSave,
    },
  }}
>
  <Stack gap="md">
    <TextInput label="Name" required />
    <TextInput label="Description" />
  </Stack>
</ComposedDialog>
```

---

## Common Props

| Prop              | Options                               | Example               |
| ----------------- | ------------------------------------- | --------------------- |
| **size**          | `xs`, `sm`, `md`, `lg`, `xl`, `full`  | `size="lg"`           |
| **loading**       | `true`, `false`                       | `loading={isLoading}` |
| **footer.layout** | `flex-end`, `space-between`, `center` | `layout="flex-end"`   |

---

## Button Variants

```tsx
variant = 'filled'; // Solid color (primary)
variant = 'default'; // Gray outline (cancel)
variant = 'light'; // Light background
variant = 'outline'; // Colored outline
```

---

## Icon Colors

```tsx
iconColor = 'blue'; // General
iconColor = 'green'; // Money/Success
iconColor = 'red'; // Delete/Danger
iconColor = 'orange'; // Warning/Edit
iconColor = 'teal'; // Info
```

---

## Common Icons

```tsx
import {
  IconPlus, // Add
  IconEdit, // Edit
  IconTrash, // Delete
  IconReceipt, // Expense
  IconUser, // User
  IconSettings, // Settings
  IconCheck, // Success
  IconX, // Error
} from '@tabler/icons-react';
```

---

## 3 Ways to Use

### 1. Simple

```tsx
<Dialog opened={opened} onClose={onClose} title="Alert">
  <Text>Message</Text>
</Dialog>
```

### 2. Composed (Custom)

```tsx
<Dialog opened={opened} onClose={onClose}>
  <DialogHeader title="Custom" />
  <DialogBody>{content}</DialogBody>
  <DialogFooter primaryButton={{...}} />
</Dialog>
```

### 3. All-in-One (Config)

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{ title: 'Form' }}
  footer={{ primaryButton: {...} }}
>
  {content}
</ComposedDialog>
```

---

## Full Example (Copy & Modify)

```tsx
import { useState } from 'react';
import { ComposedDialog } from '@/components/shared/Dialog';
import { Stack, TextInput, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

function MyComponent() {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    console.log('Saving:', name);
    setOpened(false);
  };

  return (
    <>
      <Button onClick={() => setOpened(true)}>Add Item</Button>

      <ComposedDialog
        opened={opened}
        onClose={() => setOpened(false)}
        size="lg"
        header={{
          title: 'Add New Item',
          subtitle: 'Fill in the details',
          icon: <IconPlus size={24} />,
          iconColor: 'blue',
        }}
        footer={{
          secondaryButton: {
            label: 'Cancel',
            onClick: () => setOpened(false),
            variant: 'default',
          },
          primaryButton: {
            label: 'Save',
            onClick: handleSave,
            disabled: !name,
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Stack>
      </ComposedDialog>
    </>
  );
}
```

---

## Documentation Files

| File                                     | Purpose           |
| ---------------------------------------- | ----------------- |
| `DIALOG_COMPONENT_COMPLETE.md`           | 📋 Summary        |
| `DIALOG_COMPONENT_GUIDE.md`              | 📖 Full guide     |
| `DIALOG_MIGRATION_CHECKLIST.md`          | 🔄 Migration      |
| `DIALOG_FILE_STRUCTURE.md`               | 📁 File tree      |
| `src/components/shared/Dialog/README.md` | 🚀 Component docs |

---

## Examples to Copy From

```
src/components/shared/Dialog/examples/
├── ExpenseDialog.example.tsx        ← Complex form
├── ConfirmationDialog.example.tsx   ← Simple confirm
└── WizardDialog.example.tsx         ← Multi-step
```

---

## Common Patterns

### Add/Edit Pattern

```tsx
header={{
  title: editing ? 'Edit Item' : 'Add New Item'
}}
footer={{
  primaryButton: {
    label: editing ? 'Update' : 'Add',
    onClick: onSave
  }
}}
```

### Delete Confirmation

```tsx
<Dialog opened={opened} onClose={onClose} size="sm">
  <DialogBody>
    <Group>
      <IconTrash color="red" />
      <Text>Delete?</Text>
    </Group>
  </DialogBody>
  <DialogFooter
    primaryButton={{ label: 'Delete', color: 'red', onClick: del }}
  />
</Dialog>
```

### Loading State

```tsx
<ComposedDialog
  opened={opened}
  loading={isLoading}
  ...
/>
```

---

## Tips

✅ **Use `ComposedDialog`** for most cases  
✅ **Add icons** to headers for visual clarity  
✅ **Set `maxHeight`** on DialogBody for long content  
✅ **Disable primary button** until form is valid  
✅ **Use `layout="space-between"`** for delete buttons on left  
✅ **Set `loading={true}`** during async operations

---

## Need Help?

1. Check examples in `examples/` folder
2. Read `DIALOG_COMPONENT_GUIDE.md`
3. Look at TypeScript types in `Dialog.types.ts`

---

**That's it! Start using now!** 🎉
