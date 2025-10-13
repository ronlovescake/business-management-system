# 🎨 Dialog Component - Visual Design Match

## Your Design Requirements (From Images)

### Image 1: "Add Menu" Modal

**Requirements:**

- ✅ Clean, centered title
- ✅ Close button (X) in top-right
- ✅ White background
- ✅ Subtle shadow/border
- ✅ Bottom action buttons (Close + Save Changes)
- ✅ Buttons right-aligned
- ✅ "Close" button: lighter style
- ✅ "Save Changes" button: primary/green style

### Image 2: "Add New Expense" Modal

**Requirements:**

- ✅ Title: "Add New Expense"
- ✅ Form fields with labels
- ✅ Date picker input
- ✅ Category dropdown (Select category)
- ✅ Amount input with $0 placeholder
- ✅ Trip ID input
- ✅ Description textarea
- ✅ Notes textarea
- ✅ Receipt upload button
- ✅ Bottom buttons: Cancel (left/gray) + Add (right/primary)

---

## How the New Dialog Component Matches

### ✅ Matches Image 1 - "Add Menu" Style

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{
    title: 'Add Menu',
    // Clean title with automatic close button in top-right
  }}
  footer={{
    layout: 'flex-end', // Buttons right-aligned like in your design
    secondaryButton: {
      label: 'Close',
      onClick: onClose,
      variant: 'light', // Lighter style like your design
    },
    primaryButton: {
      label: 'Save Changes',
      onClick: onSave,
      color: 'green', // Primary green button
    },
  }}
>
  {/* Your form content */}
</ComposedDialog>
```

**Result**: Exactly matches your design ✅

---

### ✅ Matches Image 2 - "Add New Expense" Style

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  size="lg"
  header={{
    title: 'Add New Expense',
    icon: <IconReceipt size={24} />,
    iconColor: 'green',
  }}
  footer={{
    layout: 'flex-end',
    secondaryButton: {
      label: 'Cancel',
      onClick: onClose,
      variant: 'default', // Gray style
    },
    primaryButton: {
      label: 'Add',
      onClick: onSave,
      // Primary blue button (Mantine default)
    },
  }}
>
  <Stack gap="md">
    <TextInput label="Date" type="date" required />

    <NumberInput label="Amount" placeholder="0" prefix="$" required />

    <Select
      label="Category"
      placeholder="Select category"
      data={categories}
      required
    />

    <TextInput label="Trip ID (Optional)" placeholder="e.g., TRP-001" />

    <TextInput label="Description" required placeholder="Brief description" />

    <Textarea
      label="Notes (Optional)"
      placeholder="Additional notes"
      minRows={3}
    />

    <FileButton onChange={setFile} accept="image/*,.pdf">
      {(props) => (
        <Button {...props} variant="light" fullWidth>
          Click to upload receipt
        </Button>
      )}
    </FileButton>
  </Stack>
</ComposedDialog>
```

**Result**: Exactly matches your expense form design ✅

---

## Design Elements Provided by Dialog Component

### 🎨 Visual Consistency

1. **Modal Background**
   - ✅ White card with rounded corners
   - ✅ Subtle shadow (elevation)
   - ✅ Overlay backdrop with blur

2. **Header Section**
   - ✅ Large title text
   - ✅ Optional subtitle (gray)
   - ✅ Optional icon with color
   - ✅ Close button (X) top-right

3. **Body Section**
   - ✅ Clean padding
   - ✅ Auto-scroll if content is long
   - ✅ Consistent spacing

4. **Footer Section**
   - ✅ Divider line above buttons
   - ✅ Flexible button layouts
   - ✅ Consistent button spacing
   - ✅ Primary/secondary button styles

---

## Button Styles Supported

### Primary Button (Action)

```tsx
{
  label: 'Save Changes',
  onClick: onSave,
  variant: 'filled', // Solid background
  color: 'blue' // or 'green', 'red', etc.
}
```

**Appearance**: Solid color, prominent

### Secondary Button (Cancel/Close)

```tsx
{
  label: 'Close',
  onClick: onClose,
  variant: 'default' // Gray outline
}
```

**Appearance**: Gray outline, subtle

### Light Button (Alternative)

```tsx
{
  label: 'Upload',
  onClick: onUpload,
  variant: 'light' // Light background
}
```

**Appearance**: Light colored background

### Danger Button (Delete)

```tsx
{
  label: 'Delete',
  onClick: onDelete,
  color: 'red',
  variant: 'light'
}
```

**Appearance**: Light red background

---

## Layout Options

### Right-aligned buttons (Like your images)

```tsx
<DialogFooter
  layout="flex-end"
  secondaryButton={{ label: 'Cancel' }}
  primaryButton={{ label: 'Save' }}
/>
```

**Result**: `[Cancel] [Save]` on the right

### Space between buttons

```tsx
<DialogFooter
  layout="space-between"
  secondaryButton={{ label: 'Delete' }}
  primaryButton={{ label: 'Save' }}
/>
```

**Result**: `[Delete]          [Save]`

### Centered buttons

```tsx
<DialogFooter layout="center" primaryButton={{ label: 'OK' }} />
```

**Result**: `        [OK]        `

---

## Size Options

### Small (Confirmations)

```tsx
size = 'sm'; // Like "Delete confirmation?"
```

### Medium (Default forms)

```tsx
size = 'md'; // Standard forms
```

### Large (Complex forms)

```tsx
size = 'lg'; // Like your "Add New Expense"
```

### Extra Large (Full forms)

```tsx
size = 'xl'; // Detailed customer forms
```

### Full Screen

```tsx
size = 'full'; // Takes entire screen
```

---

## Comparing: Before vs After

### BEFORE (Manual Modal)

```tsx
<Modal opened={opened} onClose={onClose} title="Add Menu">
  <Stack gap="md">
    <TextInput label="Name" />
    <TextInput label="Price" />

    {/* Manual footer with Group */}
    <Group justify="flex-end" mt="md">
      <Button variant="light" onClick={onClose}>
        Close
      </Button>
      <Button onClick={onSave}>Save Changes</Button>
    </Group>
  </Stack>
</Modal>
```

**Issues**:

- ❌ No icon support in header
- ❌ Manual button layout
- ❌ No divider before buttons
- ❌ No subtitle option
- ❌ Inconsistent spacing
- ❌ Duplicate footer code everywhere

### AFTER (New Dialog)

```tsx
<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{
    title: 'Add Menu',
    icon: <IconPlus size={24} />,
    iconColor: 'blue',
  }}
  footer={{
    secondaryButton: { label: 'Close', onClick: onClose },
    primaryButton: { label: 'Save Changes', onClick: onSave },
  }}
>
  <Stack gap="md">
    <TextInput label="Name" />
    <TextInput label="Price" />
  </Stack>
</ComposedDialog>
```

**Benefits**:

- ✅ Icon in header
- ✅ Automatic button layout
- ✅ Automatic divider
- ✅ Subtitle support
- ✅ Consistent spacing
- ✅ Reusable configuration

---

## Icon Examples

```tsx
import {
  IconReceipt,
  IconUser,
  IconSettings,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck
} from '@tabler/icons-react';

// Expense dialog
header={{ icon: <IconReceipt size={24} />, iconColor: 'green' }}

// User dialog
header={{ icon: <IconUser size={24} />, iconColor: 'blue' }}

// Settings dialog
header={{ icon: <IconSettings size={24} />, iconColor: 'gray' }}

// Add dialog
header={{ icon: <IconPlus size={24} />, iconColor: 'blue' }}

// Edit dialog
header={{ icon: <IconEdit size={24} />, iconColor: 'orange' }}

// Delete dialog
header={{ icon: <IconTrash size={24} />, iconColor: 'red' }}
```

---

## Color Schemes

### For Financial/Money (Expenses, Invoices)

```tsx
color: 'green';
iconColor: 'green';
```

### For Users/People

```tsx
color: 'blue';
iconColor: 'blue';
```

### For Warnings

```tsx
color: 'orange';
iconColor: 'orange';
```

### For Danger/Delete

```tsx
color: 'red';
iconColor: 'red';
```

### For Success

```tsx
color: 'teal';
iconColor: 'teal';
```

---

## Summary

✅ **Your "Add Menu" design** → Use `ComposedDialog` with right-aligned buttons  
✅ **Your "Add New Expense" design** → Use `ComposedDialog` with form fields  
✅ **Consistent styling** → All dialogs look the same  
✅ **Easy customization** → Props for everything  
✅ **Reusable** → Write once, use everywhere

**The new Dialog component gives you the exact look from your images, but reusable across your entire codebase!** 🎯
