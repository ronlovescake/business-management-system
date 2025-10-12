# Undo/Redo Feature for Glide Data Grid

## Overview

Added undo/redo functionality to the Notes column in the Shipments table using Glide Data Grid. Users can now undo and redo their edits with keyboard shortcuts or UI buttons.

## Implementation Details

### 1. Custom Hook: `useUndoRedo`

**Location:** `/src/hooks/useUndoRedo.ts`

The hook manages undo/redo state and provides keyboard shortcuts:

**Features:**

- Maintains undo and redo stacks for edit history
- Captures cell content before edits
- Provides `undo()` and `redo()` functions
- Tracks `canUndo` and `canRedo` states
- Handles keyboard shortcuts:
  - **Undo:** `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac)
  - **Redo:** `Ctrl+Shift+Z` (Mac) or `Ctrl+Y` (Windows/Linux)

**API:**

```typescript
const {
  gridSelection,
  onCellEdited,
  onGridSelectionChange,
  undo,
  redo,
  canUndo,
  canRedo,
} = useUndoRedo(gridRef, getCellContent, setCellValue);
```

### 2. DataTable Component Updates

**Location:** `/src/components/ui/DataTable.tsx`

Added support for:

- `gridSelection`: Current grid selection state
- `onGridSelectionChange`: Callback for selection changes
- `gridRef`: Reference to the grid instance for forcing redraws

### 3. Shipments Page Integration

**Location:** `/src/app/clothing/operations/shipments/page.tsx`

**Key Changes:**

1. Added grid ref for undo/redo functionality
2. Created `getCellContentForUndo` and `setCellValue` callbacks
3. Integrated `useUndoRedo` hook
4. Added undo/redo buttons next to the search bar
5. Connected handlers to DataTable component

**UI Elements:**

- **Undo Button**: Blue circular button with back arrow icon
- **Redo Button**: Blue circular button with forward arrow icon
- Both buttons show tooltips with keyboard shortcuts
- Buttons are disabled when no actions are available

## Usage

### For Users:

1. **Edit a note** in the Notes column by clicking and typing
2. **Undo the edit:**
   - Click the undo button (← icon)
   - Or press `Ctrl+Z` (Windows/Linux) or `Cmd+Z` (Mac)
3. **Redo the edit:**
   - Click the redo button (→ icon)
   - Or press `Ctrl+Shift+Z` (Mac) or `Ctrl+Y` (Windows/Linux)

### For Developers:

To add undo/redo to other Glide Data Grid tables:

```typescript
// 1. Import the hook
import { useUndoRedo } from '../hooks/useUndoRedo';

// 2. Create a grid ref
const gridRef = useRef<{
  getBounds: (col: number, row: number) => {...} | undefined;
  damage?: (cells: { cell: Item }[]) => void;
} | null>(null);

// 3. Create getCellContent and setCellValue functions
const getCellContentForUndo = useCallback((cell: Item) => {
  // Return the cell content
}, [dependencies]);

const setCellValue = useCallback(async (cell: Item, newValue: GridCell) => {
  // Update the cell value in your data
}, [dependencies]);

// 4. Use the hook
const {
  gridSelection,
  onCellEdited,
  onGridSelectionChange,
  undo,
  redo,
  canUndo,
  canRedo,
} = useUndoRedo(gridRef, getCellContentForUndo, setCellValue);

// 5. Pass props to DataTable
<DataTable
  gridRef={gridRef}
  onCellEdited={onCellEdited}
  gridSelection={gridSelection}
  onGridSelectionChange={onGridSelectionChange}
  // ... other props
/>

// 6. Add undo/redo buttons
<ActionIcon onClick={undo} disabled={!canUndo}>
  <IconArrowBackUp />
</ActionIcon>
<ActionIcon onClick={redo} disabled={!canRedo}>
  <IconArrowForwardUp />
</ActionIcon>
```

## Technical Details

### How It Works:

1. **Before Edit:** The hook captures the current cell value using `getCellContent`
2. **During Edit:** The edit is applied via `setCellValue` and added to the undo stack
3. **On Undo:** The previous value is restored from the undo stack and the action moves to redo stack
4. **On Redo:** The edit is reapplied from the redo stack and moves back to undo stack
5. **Grid Refresh:** The grid is forced to redraw using `gridRef.current.damage()`

### State Management:

- **Undo Stack:** Array of `{ cell, oldValue, newValue }` objects
- **Redo Stack:** Cleared when a new edit is made
- **Grid Selection:** Tracks the current selected cells
- **Action Flag:** Prevents recursive calls during undo/redo operations

## Benefits

1. **User Experience:**
   - Mistakes can be easily corrected
   - Users can experiment with edits
   - Standard keyboard shortcuts work as expected

2. **Data Integrity:**
   - All edits are tracked and reversible
   - API calls are made for both undo and redo operations
   - Local state stays in sync with server

3. **Accessibility:**
   - Keyboard shortcuts follow OS conventions
   - Visual feedback via button states
   - Tooltips show available shortcuts

## Future Enhancements

Potential improvements:

- Add undo/redo to other editable columns
- Implement batch undo/redo for multiple cells
- Add undo history limit (e.g., last 50 actions)
- Show undo history in a dropdown menu
- Add confirmation for destructive undo/redo operations
- Persist undo/redo history across page reloads

## Testing

Test scenarios:

1. ✅ Edit a note and undo it
2. ✅ Undo multiple edits in sequence
3. ✅ Redo an undone edit
4. ✅ Make new edit after undo (clears redo stack)
5. ✅ Use keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
6. ✅ Buttons disabled when stacks are empty
7. ✅ API calls are made correctly
8. ✅ Grid refreshes after undo/redo

## Notes

- Undo/redo only works for the Notes column (editable column)
- Each edit creates a new API call to persist changes
- The feature is scoped to the current session (no persistence across reloads)
- Undo/redo stacks are cleared when the component unmounts
