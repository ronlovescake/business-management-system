'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GridCell, GridSelection, Item } from '@glideapps/glide-data-grid';

interface EditAction {
  cell: Item;
  oldValue: GridCell;
  newValue: GridCell;
}

interface DataEditorRef {
  getBounds: (
    col: number,
    row: number
  ) => { x: number; y: number; width: number; height: number } | undefined;
  damage?: (cells: { cell: Item }[]) => void;
}

export function useUndoRedo(
  gridRef: React.RefObject<DataEditorRef>,
  getCellContent: (cell: Item) => GridCell,
  setCellValue: (cell: Item, newValue: GridCell) => void
) {
  const [undoStack, setUndoStack] = useState<EditAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditAction[]>([]);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>(
    undefined
  );
  const isUndoRedoAction = useRef(false);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // Handle cell edits
  const onCellEdited = useCallback(
    (cell: Item, newValue: GridCell) => {
      // Skip if this is an undo/redo operation
      if (isUndoRedoAction.current) {
        isUndoRedoAction.current = false;
        return;
      }

      // Get the old value before the edit
      const oldValue = getCellContent(cell);

      // Add to undo stack
      setUndoStack((prev) => [...prev, { cell, oldValue, newValue }]);

      // Clear redo stack when a new edit is made
      setRedoStack([]);

      // Apply the change
      setCellValue(cell, newValue);
    },
    [getCellContent, setCellValue]
  );

  // Undo function
  const undo = useCallback(() => {
    if (undoStack.length === 0) {
      return;
    }

    const action = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    isUndoRedoAction.current = true;

    // Revert the change
    setCellValue(action.cell, action.oldValue);

    // Move action to redo stack
    setRedoStack((prev) => [...prev, action]);
    setUndoStack(newUndoStack);

    // Force grid to redraw the cell
    gridRef.current?.damage?.([{ cell: action.cell }]);
  }, [undoStack, setCellValue, gridRef]);

  // Redo function
  const redo = useCallback(() => {
    if (redoStack.length === 0) {
      return;
    }

    const action = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    isUndoRedoAction.current = true;

    // Reapply the change
    setCellValue(action.cell, action.newValue);

    // Move action back to undo stack
    setUndoStack((prev) => [...prev, action]);
    setRedoStack(newRedoStack);

    // Force grid to redraw the cell
    gridRef.current?.damage?.([{ cell: action.cell }]);
  }, [redoStack, setCellValue, gridRef]);

  // Handle grid selection changes
  const onGridSelectionChange = useCallback((newSelection: GridSelection) => {
    setGridSelection(newSelection);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Ctrl/Cmd + Z (without Shift)
      if (ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Ctrl/Cmd + Shift + Z (Mac) or Ctrl + Y (Windows)
      if (
        (ctrlKey && e.key === 'z' && e.shiftKey) ||
        (ctrlKey && e.key === 'y' && !isMac)
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    gridSelection,
    onCellEdited,
    onGridSelectionChange,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
