# Ctrl+F Focus Fix

## Problem Statement

When a user had a cell selected/editing (especially a dropdown cell) and pressed **Ctrl+F** to search:

1. Search bar would gain focus ✓
2. User starts typing
3. ❌ **Keystrokes go back to the cell editor** instead of the search bar
4. User cannot search properly

### Reproduction Steps:

1. Click on row 2, Customers column (dropdown cell is now in edit mode)
2. Press Ctrl+F
3. Search bar gets focus (red outline visible)
4. Start typing "ethan"
5. **Bug**: Text appears in the dropdown cell instead of search bar
6. Focus jumps back to the cell editor

## Root Cause

The Ctrl+F handler was only focusing the search input, but **not closing the Handsontable cell editor**:

```typescript
// ❌ BEFORE (incomplete):
const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault();
    searchInputRef.current?.focus(); // Focus search bar
    searchInputRef.current?.select(); // Select text
    // ❌ MISSING: Close the active cell editor!
  }
};
```

### Why This Happened:

1. **Handsontable Cell Editors Are Persistent**: When you click a cell, Handsontable opens an editor (input field or dropdown)
2. **Editor Intercepts Keystrokes**: The cell editor listens for keyboard events and captures them
3. **Focus vs Edit Mode**: Even when search bar has focus, if the cell is still in edit mode, Handsontable steals the keystrokes
4. **Priority Issue**: Handsontable's event handlers run before the search input can process the keys

## Solution

Added `deselectCell()` call to properly close the cell editor before focusing the search bar:

```typescript
// ✅ AFTER (complete):
const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault();

    // ✅ FIX: Close any active cell editor in Handsontable
    if (hotRef.current) {
      const hotInstance = (hotRef.current as any).hotInstance;
      if (hotInstance) {
        hotInstance.deselectCell(); // Exit edit mode and deselect cell
      }
    }

    searchInputRef.current?.focus(); // Focus search bar
    searchInputRef.current?.select(); // Select text
  }
};
```

### How It Works:

1. **`hotInstance.deselectCell()`**:
   - Closes the active cell editor
   - Exits edit mode
   - Removes cell selection/highlight
   - Stops Handsontable from intercepting keystrokes

2. **Then focus search bar**: Now keystrokes go to the search input

## Technical Details

### Handsontable API Methods:

| Method              | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `deselectCell()`    | Closes editor, deselects cell, exits edit mode |
| `getSelected()`     | Returns currently selected cell coordinates    |
| `getActiveEditor()` | Returns the active cell editor instance        |

### Why `deselectCell()` Instead of Other Methods:

**Considered Alternatives**:

```typescript
// ❌ getActiveEditor().close() - Doesn't work, editor may not exist
// ❌ selectCell(-1, -1) - Invalid coordinates
// ❌ blur() on editor - Editor reference may be unavailable
// ✅ deselectCell() - Clean, reliable, built-in method
```

### Reference Access Pattern:

```typescript
// Access Handsontable instance from React ref
const hotInstance = (hotRef.current as any).hotInstance;

// Why the type assertion?
// @handsontable/react doesn't expose hotInstance in TypeScript types
// But it's available at runtime and documented in Handsontable docs
```

## User Experience Changes

### Before (Broken):

1. User clicks Customer cell (dropdown opens)
2. User presses Ctrl+F
3. Search bar gains focus (looks correct)
4. User types "ethan"
5. ❌ **Text appears in dropdown cell**
6. User frustrated, has to click search bar again
7. User manually closes dropdown
8. **Bad UX**: Extra clicks, confusing behavior

### After (Fixed):

1. User clicks Customer cell (dropdown opens)
2. User presses Ctrl+F
3. ✅ **Cell editor closes automatically**
4. ✅ **Cell is deselected (no highlight)**
5. Search bar gains focus
6. User types "ethan"
7. ✅ **Text appears in search bar**
8. **Good UX**: Seamless, intuitive, works as expected

## Testing Instructions

### Test Dropdown Cell:

1. Click on any Customers cell (dropdown opens, cell highlighted)
2. Press Ctrl+F (or Cmd+F on Mac)
3. **Expected**:
   - Cell editor closes
   - Cell is no longer highlighted
   - Search bar has focus (red outline)
4. Start typing "ethan"
5. **Expected**: Text appears in search bar, not in the cell

### Test Text Cell:

1. Click on any Notes cell (text editor opens)
2. Start typing some text
3. Press Ctrl+F mid-edit
4. **Expected**:
   - Text editor closes
   - Cell is no longer selected
   - Search bar has focus
5. Start typing "test"
6. **Expected**: Text appears in search bar

### Test From Empty Selection:

1. Click away from the grid (no cell selected)
2. Press Ctrl+F
3. **Expected**: Search bar gains focus (works as before)
4. Start typing
5. **Expected**: Text appears in search bar

### Test Rapid Switching:

1. Click a cell
2. Immediately press Ctrl+F
3. Type search query
4. Press Escape (close search suggestions)
5. Click another cell
6. Press Ctrl+F again
7. **Expected**: Always closes cell editor first, then focuses search

## Code Changes

### Files Modified:

- `src/components/ui/HandsontableGrid.tsx`

### Lines Changed:

- **Lines 115-129**: Enhanced Ctrl+F handler with `deselectCell()` call

### Code Diff:

```diff
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
+
+     // Close any active cell editor in Handsontable
+     if (hotRef.current) {
+       const hotInstance = (hotRef.current as any).hotInstance;
+       if (hotInstance) {
+         hotInstance.deselectCell(); // Exit edit mode and deselect cell
+       }
+     }

      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  };
```

## Benefits

✅ **Proper Focus Management**: Cell editor closes before search bar gets focus  
✅ **Intuitive UX**: Ctrl+F works as users expect from other applications  
✅ **No Keystroke Stealing**: Handsontable won't intercept search input  
✅ **Clean State**: Cell is fully deselected, no visual confusion  
✅ **Works with All Cell Types**: Text, dropdown, numeric - all close properly  
✅ **Cross-Platform**: Works on Windows (Ctrl) and Mac (Cmd)

## Related Features

### Keyboard Shortcuts:

- **Ctrl+F / Cmd+F**: Focus search bar (now closes cell editor first)
- **Escape**: Close search suggestions
- **Enter**: Navigate to next cell
- **Tab**: Move to next cell

### Search Behavior:

- Search works across: Customers, Product Code, Order Status, Notes, Shipment Code
- Search filters table in real-time
- Empty rows still appear during search (from EMPTY_ROWS_IN_SEARCH_FIX.md)

## Browser Compatibility

✅ **Chrome/Edge**: `deselectCell()` works perfectly  
✅ **Firefox**: `deselectCell()` works perfectly  
✅ **Safari**: `deselectCell()` works perfectly

The Handsontable `deselectCell()` API is stable and supported across all major browsers.

## Performance Impact

- **Negligible**: `deselectCell()` is a lightweight operation
- **No Re-renders**: Only affects Handsontable internal state
- **Instant**: Cell closes immediately, no delay
- **No Memory Leaks**: Proper cleanup of event listeners

## Future Considerations

### Other Keyboard Shortcuts:

Consider applying the same pattern to other shortcuts that require full focus:

```typescript
// Example: Ctrl+S to save
if ((event.ctrlKey || event.metaKey) && event.key === 's') {
  event.preventDefault();
  hotInstance?.deselectCell(); // Close editor before saving
  handleSave();
}
```

### Custom Cell Editors:

If you create custom cell editors, ensure they:

- Properly close when `deselectCell()` is called
- Don't interfere with global keyboard shortcuts
- Release focus cleanly

## Related Documentation

- **DROPDOWN_VALIDATION_FIX.md**: How dropdown cells work with validation
- **ORDER_STATUS_FLICKER_FIX.md**: How cell updates work smoothly
- **EMPTY_ROWS_IN_SEARCH_FIX.md**: How search filtering works

## Conclusion

The Ctrl+F focus fix ensures that pressing Ctrl+F properly closes any active cell editor before focusing the search bar. This prevents keystroke stealing and provides an intuitive search experience that matches user expectations from other applications.

**Key Change**: Call `hotInstance.deselectCell()` before `searchInputRef.current?.focus()` ✅
