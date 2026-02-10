'use client';

/**
 * Shipments Module - Form Management Hook
 *
 * This hook manages:
 * - Add and Edit modal states
 * - Form instances for both modals
 * - Double-click detection for edit
 * - Form submission handlers
 */

import { useState, useRef } from 'react';
import { useForm } from '@mantine/form';
import type { Item } from '@glideapps/glide-data-grid';
import type { ShipmentData, ShipmentFormData } from '../types/shipment.types';
import {
  DOUBLE_CLICK_WINDOW_MS,
  FORM_VALIDATION_RULES,
} from '../types/shipment.types';

/**
 * Parse date string to Date object without timezone conversion
 * Handles format: "MMM d, yyyy" (e.g., "Oct 10, 2025")
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) {
    return null;
  }

  const monthMap: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  // Parse "Oct 10, 2025" format
  const match = dateStr.match(/^([A-Za-z]+)\s+(\d+),\s+(\d+)$/);
  if (!match) {
    // Fallback to standard Date parsing
    return new Date(dateStr);
  }

  const [, monthStr, dayStr, yearStr] = match;
  const month = monthMap[monthStr];
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  if (month === undefined || isNaN(day) || isNaN(year)) {
    return new Date(dateStr);
  }

  // Create date in local timezone
  return new Date(year, month, day);
}

/**
 * Hook for managing shipment forms (Add & Edit)
 */
export function useShipmentForm() {
  // ==========================================================================
  // STATE
  // ==========================================================================

  const [addModalOpened, setAddModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentData | null>(
    null
  );

  // Track last click for double-click detection
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);

  // ==========================================================================
  // FORM INSTANCES
  // ==========================================================================

  // Form for adding new shipments
  const addShipmentForm = useForm<ShipmentFormData>({
    initialValues: {
      shipmentCode: '',
      cvNumber: '',
      noOfSacks: 0,
      totalCBM: 0,
      weight: 0,
      fee: 0,
      shipmentStatus: '',
      dateCreated: new Date(),
      dateDelivered: null,
      notes: '',
    },
    validate: {
      shipmentCode: (value) =>
        !value ? FORM_VALIDATION_RULES.shipmentCode.message : null,
      shipmentStatus: (value) =>
        !value ? FORM_VALIDATION_RULES.shipmentStatus.message : null,
      noOfSacks: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.noOfSacks.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.noOfSacks.messageMin;
        }
        return null;
      },
      totalCBM: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.totalCBM.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.totalCBM.messageMin;
        }
        return null;
      },
      weight: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.weight.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.weight.messageMin;
        }
        return null;
      },
      fee: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.fee.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.fee.messageMin;
        }
        return null;
      },
      dateCreated: (value) =>
        !value ? FORM_VALIDATION_RULES.dateCreated.message : null,
    },
  });

  // Form for editing existing shipments
  const editShipmentForm = useForm<ShipmentFormData>({
    initialValues: {
      shipmentCode: '',
      cvNumber: '',
      noOfSacks: 0,
      totalCBM: 0,
      weight: 0,
      fee: 0,
      shipmentStatus: '',
      dateCreated: null,
      dateDelivered: null,
      notes: '',
    },
    validate: {
      shipmentCode: (value) =>
        !value ? FORM_VALIDATION_RULES.shipmentCode.message : null,
      shipmentStatus: (value) =>
        !value ? FORM_VALIDATION_RULES.shipmentStatus.message : null,
      noOfSacks: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.noOfSacks.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.noOfSacks.messageMin;
        }
        return null;
      },
      totalCBM: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.totalCBM.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.totalCBM.messageMin;
        }
        return null;
      },
      weight: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.weight.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.weight.messageMin;
        }
        return null;
      },
      fee: (value) => {
        if (value === null || value === undefined) {
          return FORM_VALIDATION_RULES.fee.messageRequired;
        }
        if (value < 0) {
          return FORM_VALIDATION_RULES.fee.messageMin;
        }
        return null;
      },
      dateCreated: (value) =>
        !value ? FORM_VALIDATION_RULES.dateCreated.message : null,
    },
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Open add modal and reset form
   */
  const handleAddShipment = () => {
    addShipmentForm.reset();
    addShipmentForm.setFieldValue('dateCreated', new Date());
    setAddModalOpened(true);
  };

  /**
   * Open edit modal and populate form with existing data
   */
  const handleEditShipment = (shipment: ShipmentData) => {
    setEditingShipment(shipment);

    // Pre-populate the edit form with existing data
    editShipmentForm.setValues({
      shipmentCode: shipment['Shipment Code'],
      cvNumber: shipment['CV Number'],
      noOfSacks: shipment['No. Of Sacks'],
      totalCBM: shipment['Total CBM'],
      weight: shipment['Weight'],
      fee:
        typeof shipment['Fee'] === 'string'
          ? parseFloat(shipment['Fee'].replace(/[₱,]/g, '')) || 0
          : shipment['Fee'],
      shipmentStatus: shipment['Shipment Status'],
      dateCreated: shipment['Date Created']
        ? parseDateString(shipment['Date Created'])
        : null,
      dateDelivered: shipment['Date Delivered']
        ? parseDateString(shipment['Date Delivered'])
        : null,
      notes: shipment['Notes'],
    });

    setEditModalOpened(true);
  };

  /**
   * Handle cell click for double-click detection
   * Only triggers on Shipment Code column (col 0)
   */
  const handleCellClick = (cell: Item, shipment: ShipmentData) => {
    const [col] = cell;

    // Check if clicked on Shipment Code column (first column, index 0)
    if (col === 0) {
      const now = Date.now();
      const lastClick = lastClickRef.current;

      // Check if this is a double-click (within window on the same cell)
      if (
        lastClick &&
        lastClick.cell[0] === cell[0] &&
        lastClick.cell[1] === cell[1] &&
        now - lastClick.time < DOUBLE_CLICK_WINDOW_MS
      ) {
        // Double-click detected - open edit modal
        handleEditShipment(shipment);
        lastClickRef.current = null; // Reset after handling
      } else {
        // First click - store it
        lastClickRef.current = { cell, time: now };
      }
    }
  };

  /**
   * Close add modal
   */
  const closeAddModal = () => {
    setAddModalOpened(false);
    addShipmentForm.reset();
  };

  /**
   * Close edit modal
   */
  const closeEditModal = () => {
    setEditModalOpened(false);
    setEditingShipment(null);
    editShipmentForm.reset();
  };

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Modal States
    addModalOpened,
    editModalOpened,
    editingShipment,

    // Forms
    addShipmentForm,
    editShipmentForm,

    // Handlers
    handleAddShipment,
    handleEditShipment,
    handleCellClick,
    closeAddModal,
    closeEditModal,
  };
}
