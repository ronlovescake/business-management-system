# 🎯 Dialog Component System

A complete, modular, reusable dialog/modal component system for the entire codebase.

## 🚀 Quick Start

```tsx
import { ComposedDialog } from '@/components/shared/Dialog';
import { IconReceipt } from '@tabler/icons-react';

function MyComponent() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button onClick={() => setOpened(true)}>Open Dialog</Button>

      <ComposedDialog
        opened={opened}
        onClose={() => setOpened(false)}
        header={{
          title: 'My Dialog',
          subtitle: 'Additional context',
          icon: <IconReceipt size={24} />,
          iconColor: 'blue',
        }}
        footer={{
          secondaryButton: {
            label: 'Cancel',
            onClick: () => setOpened(false),
          },
          primaryButton: {
            label: 'Save',
            onClick: handleSave,
          },
        }}
      >
        <Stack gap="md">
          <TextInput label="Name" />
          <TextInput label="Email" />
        </Stack>
      </ComposedDialog>
    </>
  );
}
```

## 📦 Components

### 1. `Dialog` - Base Component

Maximum flexibility for custom layouts.

```tsx
<Dialog opened={opened} onClose={onClose} title="My Dialog">
  {/* Your content */}
</Dialog>
```

### 2. `ComposedDialog` - All-in-One

Configuration-based with automatic header, body, and footer.

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{ title: 'Title' }}
  footer={{
    primaryButton: { label: 'Save', onClick: save },
  }}
>
  {/* Your content */}
</ComposedDialog>
```

### 3. Sub-Components for Composition

```tsx
<Dialog opened={opened} onClose={onClose}>
  <DialogHeader title="Title" icon={<IconPlus />} />
  <DialogBody maxHeight="60vh">{/* Your content */}</DialogBody>
  <DialogFooter
    secondaryButton={{ label: 'Cancel', onClick: close }}
    primaryButton={{ label: 'Save', onClick: save }}
  />
</Dialog>
```

## 🎨 Features

- ✅ **Fully Typed** - Complete TypeScript support
- ✅ **Flexible** - Use sub-components or all-in-one
- ✅ **Configurable** - Props for everything
- ✅ **Responsive** - Works on all screen sizes
- ✅ **Accessible** - Built on Mantine Modal
- ✅ **Loading States** - Built-in loading spinner
- ✅ **Button Layouts** - Multiple footer layouts
- ✅ **Icons** - Easy header icons with colors
- ✅ **Scrollable** - Auto-scroll for long content

## 📖 Documentation

- **Full Guide**: See `../../DIALOG_COMPONENT_GUIDE.md`
- **Migration**: See `../../DIALOG_MIGRATION_CHECKLIST.md`
- **Examples**: Check the `examples/` folder

## 💡 Examples

### Simple Dialog

```tsx
<Dialog opened={opened} onClose={onClose} title="Alert">
  <Text>This is a simple message.</Text>
</Dialog>
```

### Form Dialog

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{ title: 'Add Item', icon: <IconPlus /> }}
  footer={{
    secondaryButton: { label: 'Cancel', onClick: onClose },
    primaryButton: { label: 'Add', onClick: onAdd },
  }}
>
  <Stack gap="md">
    <TextInput label="Name" required />
    <TextInput label="Description" />
  </Stack>
</ComposedDialog>
```

### Confirmation Dialog

```tsx
<Dialog opened={opened} onClose={onClose} size="sm">
  <DialogBody>
    <Group gap="md">
      <IconTrash size={32} color="red" />
      <Stack gap="xs">
        <Text fw={600}>Delete item?</Text>
        <Text size="sm" c="dimmed">
          This cannot be undone.
        </Text>
      </Stack>
    </Group>
  </DialogBody>
  <DialogFooter
    secondaryButton={{ label: 'Cancel', onClick: onClose }}
    primaryButton={{ label: 'Delete', onClick: onDelete, color: 'red' }}
  />
</Dialog>
```

## 🔧 Props

### Dialog Props

| Prop      | Type                                             | Default | Description      |
| --------- | ------------------------------------------------ | ------- | ---------------- |
| `opened`  | `boolean`                                        | -       | Open/close state |
| `onClose` | `() => void`                                     | -       | Close handler    |
| `title`   | `ReactNode`                                      | -       | Dialog title     |
| `size`    | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'`  | Dialog size      |
| `loading` | `boolean`                                        | `false` | Show loader      |

### DialogHeader Props

| Prop        | Type        | Description   |
| ----------- | ----------- | ------------- |
| `title`     | `ReactNode` | Header title  |
| `subtitle`  | `string`    | Subtitle text |
| `icon`      | `ReactNode` | Icon element  |
| `iconColor` | `string`    | Icon color    |

### DialogFooter Props

| Prop                | Type                                                        | Description      |
| ------------------- | ----------------------------------------------------------- | ---------------- |
| `primaryButton`     | `DialogButton`                                              | Primary action   |
| `secondaryButton`   | `DialogButton`                                              | Secondary action |
| `additionalButtons` | `DialogButton[]`                                            | Extra buttons    |
| `layout`            | `'space-between' \| 'flex-end' \| 'flex-start' \| 'center'` | Button layout    |

### DialogButton Type

```tsx
interface DialogButton {
  label: string;
  onClick: () => void;
  color?: string;
  variant?: 'filled' | 'light' | 'outline' | 'default';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}
```

## 🎯 Use Cases

✅ Add/Edit forms  
✅ Delete confirmations  
✅ View details  
✅ Multi-step wizards  
✅ Settings panels  
✅ Alerts and notifications  
✅ File uploads  
✅ Search interfaces

## 📝 Best Practices

1. **Use ComposedDialog** for standard forms
2. **Use Dialog + sub-components** for complex layouts
3. **Add icons** to headers for visual clarity
4. **Set maxHeight** on DialogBody for long content
5. **Disable primary button** until form is valid
6. **Show loading states** during async operations
7. **Use confirmation dialogs** for destructive actions

## 🔗 Import Paths

```tsx
// All components
import {
  Dialog,
  ComposedDialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@/components/shared/Dialog';

// Types
import type { DialogProps, DialogButton } from '@/components/shared/Dialog';
```

## 🐛 Troubleshooting

**Dialog not showing?**  
→ Check `opened` prop is `true`

**Close button not working?**  
→ Ensure `onClose` is provided

**Content too long?**  
→ Add `maxHeight` to DialogBody

**Buttons not appearing?**  
→ Check DialogFooter configuration

## 📚 Learn More

- Full documentation: `DIALOG_COMPONENT_GUIDE.md`
- Migration guide: `DIALOG_MIGRATION_CHECKLIST.md`
- Working examples: `examples/` folder
- Mantine Modal: https://mantine.dev/core/modal/

---

**Built for reusability across the entire codebase** 🚀
