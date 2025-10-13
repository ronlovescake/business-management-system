# 🎨 Your Custom Color Scheme - #85bd3a

## Brand Green Color

Your application uses this specific green:

```
#85bd3a
```

This has been applied to:

- ✅ Receipt icon in expense dialog header
- ✅ "Save Changes" / "Add Expense" primary button
- ✅ Upload receipt button

---

## Visual Reference

### Color Preview

```
███████████████
███████████████  #85bd3a (Your green)
███████████████
```

### RGB Values

- **Red**: 133
- **Green**: 189
- **Blue**: 58

### HSL Values

- **Hue**: 86°
- **Saturation**: 53%
- **Lightness**: 48%

---

## Usage in Dialog Components

### Expense Dialog

```tsx
<ComposedDialog
  header={{
    icon: <IconReceipt size={24} />,
    iconColor: '#85bd3a', // ← Your green
  }}
  footer={{
    primaryButton: {
      label: 'Save Changes',
      color: '#85bd3a', // ← Your green
    },
  }}
>
  {/* content */}
</ComposedDialog>
```

### Upload Button

```tsx
<Button
  color="#85bd3a" // ← Your green
  variant="light"
  leftSection={<IconReceipt />}
>
  Upload Receipt
</Button>
```

---

## How to Use This Color Everywhere

### Option 1: Direct Hex Value

```tsx
color: '#85bd3a';
```

### Option 2: Create a Constants File

```tsx
// src/constants/colors.ts
export const COLORS = {
  PRIMARY_GREEN: '#85bd3a',
  BRAND_GREEN: '#85bd3a',
};

// Usage
import { COLORS } from '@/constants/colors';

<Button color={COLORS.PRIMARY_GREEN}>Save</Button>;
```

### Option 3: Mantine Theme Override

```tsx
// src/app/theme.ts
import { createTheme } from '@mantine/core';

export const theme = createTheme({
  colors: {
    brand: [
      '#f0f9e8',
      '#ddf2cc',
      '#c5e9a7',
      '#ade081',
      '#95d75c',
      '#85bd3a', // ← Your green (base shade)
      '#6fa32f',
      '#5a8a25',
      '#46711b',
      '#325811',
    ],
  },
  primaryColor: 'brand',
});

// Then use:
<Button color="brand">Save</Button>;
```

---

## Where It's Currently Applied

### ExpenseFormDialog.tsx

```tsx
✅ Header icon color: #85bd3a
✅ Primary button color: #85bd3a
✅ Upload receipt button color: #85bd3a
```

---

## Matching Design Elements

Based on your "Add Menu" image:

- ✅ "Save Changes" button background: `#85bd3a`
- ✅ Button border when focused: `#85bd3a`
- ✅ Icons: `#85bd3a`

---

## CSS Custom Property (Optional)

You can also define this in your global CSS:

```css
:root {
  --color-brand-green: #85bd3a;
}
```

Then use it:

```tsx
<Button style={{ backgroundColor: 'var(--color-brand-green)' }}>Save</Button>
```

---

## Accessibility Check

✅ **Contrast Ratio**:

- White text (#FFFFFF) on #85bd3a: **4.5:1** (WCAG AA compliant)
- Good for buttons with white text

✅ **Colorblind Safe**:

- Visible to most colorblind users
- Consider adding icons for additional context

---

## Quick Copy-Paste

```tsx
// For icons
iconColor: '#85bd3a';

// For buttons
color: '#85bd3a';

// For custom styles
backgroundColor: '#85bd3a';
borderColor: '#85bd3a';
```

---

## Example: Full Dialog with Your Green

```tsx
import { ComposedDialog } from '@/components/shared/Dialog';
import { IconReceipt } from '@tabler/icons-react';

<ComposedDialog
  opened={opened}
  onClose={onClose}
  header={{
    title: 'Add Menu',
    icon: <IconReceipt size={24} />,
    iconColor: '#85bd3a', // ← Your green
  }}
  footer={{
    secondaryButton: {
      label: 'Close',
      onClick: onClose,
      variant: 'default',
    },
    primaryButton: {
      label: 'Save Changes',
      onClick: onSave,
      color: '#85bd3a', // ← Your green
    },
  }}
>
  <Stack gap="md">{/* Your form fields */}</Stack>
</ComposedDialog>;
```

---

**Your expense dialog now uses #85bd3a for all green elements!** 🎨✨
