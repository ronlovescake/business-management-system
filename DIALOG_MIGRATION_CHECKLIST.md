# 🔄 Dialog Component - Migration Checklist

## ✅ What Was Created

### Core Components (4 files)

- ✅ `Dialog.tsx` - Base dialog component with all Mantine Modal features
- ✅ `DialogHeader.tsx` - Reusable header with icon, subtitle, close button
- ✅ `DialogBody.tsx` - Reusable body with scroll support
- ✅ `DialogFooter.tsx` - Reusable footer with button configuration

### Type Definitions

- ✅ `Dialog.types.ts` - Full TypeScript definitions for all components

### Examples (3 files)

- ✅ `ExpenseDialog.example.tsx` - Complex form dialog
- ✅ `ConfirmationDialog.example.tsx` - Simple confirmation dialog
- ✅ `WizardDialog.example.tsx` - Multi-step wizard dialog

### Documentation

- ✅ `DIALOG_COMPONENT_GUIDE.md` - Complete usage guide with 7+ examples

---

## 📦 File Structure

```
src/components/shared/Dialog/
├── Dialog.tsx              ✅ Main component (Dialog + ComposedDialog)
├── DialogHeader.tsx        ✅ Header sub-component
├── DialogBody.tsx          ✅ Body sub-component
├── DialogFooter.tsx        ✅ Footer sub-component
├── Dialog.types.ts         ✅ TypeScript definitions
├── index.ts               ✅ Exports
└── examples/              ✅ Example implementations
    ├── ExpenseDialog.example.tsx
    ├── ConfirmationDialog.example.tsx
    └── WizardDialog.example.tsx
```

---

## 🚀 How to Use in Your Code

### Step 1: Import the Component

```tsx
// Option 1: All-in-one dialog
import { ComposedDialog } from '@/components/shared/Dialog';

// Option 2: Flexible composition
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from '@/components/shared/Dialog';

// Option 3: Types only
import type { DialogProps, DialogButton } from '@/components/shared/Dialog';
```

### Step 2: Replace Your Existing Modal

#### BEFORE (Old Code):

```tsx
<Modal
  opened={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="Add Menu"
  size="lg"
>
  <Stack gap="md">
    <TextInput label="Name" />
    <TextInput label="Price" />

    <Group justify="flex-end" mt="md">
      <Button variant="light" onClick={() => setIsModalOpen(false)}>
        Close
      </Button>
      <Button onClick={handleSave}>Save Changes</Button>
    </Group>
  </Stack>
</Modal>
```

#### AFTER (New Code):

```tsx
<ComposedDialog
  opened={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  header={{
    title: 'Add Menu',
    subtitle: 'Create a new menu item',
    icon: <IconPlus size={24} />,
    iconColor: 'blue',
  }}
  footer={{
    secondaryButton: {
      label: 'Close',
      onClick: () => setIsModalOpen(false),
      variant: 'light',
    },
    primaryButton: {
      label: 'Save Changes',
      onClick: handleSave,
    },
  }}
  size="lg"
>
  <Stack gap="md">
    <TextInput label="Name" />
    <TextInput label="Price" />
  </Stack>
</ComposedDialog>
```

---

## 🎯 Migration Strategy

### Phase 1: New Features (Recommended First)

- ✅ Use Dialog component for all NEW modals going forward
- ✅ Build consistency from new code

### Phase 2: High-Priority Pages

Migrate dialogs in these critical areas:

- ✅ Expenses page (`/clothing/employees/expenses`)
- ✅ Customers page
- ✅ Menu management
- ✅ Any user-facing CRUD operations

### Phase 3: Remaining Pages

- ✅ Convert all other modals progressively
- ✅ Search codebase for `<Modal` and replace

### Phase 4: Cleanup

- ✅ Remove duplicate modal code
- ✅ Standardize button labels
- ✅ Update documentation

---

## 🔍 Finding Existing Modals

### Search Command:

```bash
# Find all Modal usage
grep -r "Modal" --include="*.tsx" --include="*.ts" src/
```

### Common Patterns to Replace:

1. ✅ `<Modal opened={...} onClose={...} title={...}>`
2. ✅ Manual header with close button
3. ✅ Manual footer with buttons
4. ✅ Inconsistent button layouts

---

## 📊 Benefits Summary

| Feature            | Before                         | After                              |
| ------------------ | ------------------------------ | ---------------------------------- |
| **Lines of Code**  | ~50 lines per modal            | ~20-30 lines per modal             |
| **Consistency**    | ❌ Different styles everywhere | ✅ Same look across app            |
| **Reusability**    | ❌ Copy-paste code             | ✅ Import and configure            |
| **Type Safety**    | ⚠️ Partial                     | ✅ Full TypeScript                 |
| **Maintenance**    | ❌ Update each modal           | ✅ Update once, applies everywhere |
| **Button Layout**  | ❌ Manual Group components     | ✅ Configured with layout prop     |
| **Icons**          | ❌ Inconsistent or missing     | ✅ Easy to add to header           |
| **Loading States** | ⚠️ Manual implementation       | ✅ Built-in loading prop           |

---

## 🎨 Style Customization

### Option 1: Override Props

```tsx
<Dialog
  opened={opened}
  onClose={onClose}
  padding="xl"
  overlayOpacity={0.7}
  overlayBlur={5}
>
  {/* content */}
</Dialog>
```

### Option 2: CSS Classes

```tsx
<Dialog opened={opened} onClose={onClose} className="my-custom-dialog">
  {/* content */}
</Dialog>
```

### Option 3: Modify Base Component

Edit `/src/components/shared/Dialog/Dialog.tsx` to change defaults globally.

---

## 🔧 Common Use Cases

### 1. Add/Edit Form

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{ title: editing ? 'Edit' : 'Add', icon: <IconPlus /> }}
  footer={{
    secondaryButton: { label: 'Cancel', onClick: onClose },
    primaryButton: { label: 'Save', onClick: onSave },
  }}
>
  {/* form fields */}
</ComposedDialog>
```

### 2. Delete Confirmation

```tsx
<Dialog opened={opened} onClose={onClose} size="sm">
  <DialogBody>
    <Group>
      <IconTrash color="red" />
      <Text>Delete item?</Text>
    </Group>
  </DialogBody>
  <DialogFooter
    secondaryButton={{ label: 'Cancel', onClick: onClose }}
    primaryButton={{ label: 'Delete', onClick: onDelete, color: 'red' }}
  />
</Dialog>
```

### 3. View Details

```tsx
<Dialog opened={opened} onClose={onClose} title="Details" size="xl">
  {/* view-only content */}
</Dialog>
```

### 4. Multi-Action Dialog

```tsx
<DialogFooter
  layout="space-between"
  additionalButtons={[
    { label: 'Delete', onClick: del, color: 'red', variant: 'light' },
  ]}
  secondaryButton={{ label: 'Cancel', onClick: close }}
  primaryButton={{ label: 'Save', onClick: save }}
/>
```

---

## ✅ Checklist for Each Page

When migrating a page:

- [ ] Find all `<Modal>` components
- [ ] Identify modal purpose (add/edit/delete/view)
- [ ] Replace with appropriate Dialog pattern
- [ ] Add header icon if relevant
- [ ] Configure footer buttons
- [ ] Test open/close functionality
- [ ] Test form submission
- [ ] Test validation
- [ ] Test loading states
- [ ] Verify styling matches design
- [ ] Check mobile responsiveness

---

## 🐛 Common Issues & Solutions

### Issue: Modal not opening

**Solution**: Make sure `opened` prop is passed correctly

### Issue: Close button not working

**Solution**: Ensure `onClose` is passed and `withCloseButton={true}`

### Issue: Buttons not showing

**Solution**: Check `DialogFooter` props are configured correctly

### Issue: Content too long

**Solution**: Add `maxHeight` to `DialogBody`: `<DialogBody maxHeight="60vh">`

### Issue: Can't click outside to close

**Solution**: Set `closeOnClickOutside={true}` (default is true)

---

## 📚 Additional Resources

- ✅ See `DIALOG_COMPONENT_GUIDE.md` for full documentation
- ✅ Check `examples/` folder for working implementations
- ✅ Review TypeScript types in `Dialog.types.ts`
- ✅ Mantine Modal docs: https://mantine.dev/core/modal/

---

## 🎉 Next Steps

1. ✅ **Start using Dialog in new features**
2. ✅ **Pick one page to migrate first** (recommend: Expenses page)
3. ✅ **Test thoroughly**
4. ✅ **Document any custom patterns** your team creates
5. ✅ **Share with team** and get feedback
6. ✅ **Progressively migrate** other pages

---

**Questions or issues?** Check the examples or create a custom wrapper for your specific use case!
