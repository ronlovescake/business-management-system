/**
 * Shipments Module - Service Layer
 *
 * This service encapsulates all business logic for the Shipments module:
 * - Form validation
 * - Date calculations (duration)
 * - Statistics aggregation
 * - API interactions (CRUD operations)
 * - CSV parsing and import
 * - Data transformations
 */

import { notifications } from '@mantine/notifications';
import type {
  ShipmentData,
  ShipmentFormData,
  ShipmentStatistics,
  ValidationResult,
} from '../types/shipment.types';
import {
  API_REVALIDATION_SECONDS,
  FORM_VALIDATION_RULES,
} from '../types/shipment.types';

/**
 * ShipmentService - Static methods for shipment business logic
 */
export class ShipmentService {
  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate shipment form data
   *
   * @param data - Form data to validate
   * @returns ValidationResult with errors if any
   */
  static validateShipment(data: ShipmentFormData): ValidationResult {
    const errors: Record<string, string> = {};

    // Shipment Code (required)
    if (!data.shipmentCode || data.shipmentCode.trim() === '') {
      errors.shipmentCode = FORM_VALIDATION_RULES.shipmentCode.message;
    }

    // Shipment Status (required)
    if (!data.shipmentStatus || data.shipmentStatus.trim() === '') {
      errors.shipmentStatus = FORM_VALIDATION_RULES.shipmentStatus.message;
    }

    // No. Of Sacks (required, non-negative)
    if (data.noOfSacks === null || data.noOfSacks === undefined) {
      errors.noOfSacks = FORM_VALIDATION_RULES.noOfSacks.messageRequired;
    } else if (data.noOfSacks < 0) {
      errors.noOfSacks = FORM_VALIDATION_RULES.noOfSacks.messageMin;
    }

    // Total CBM (required, non-negative)
    if (data.totalCBM === null || data.totalCBM === undefined) {
      errors.totalCBM = FORM_VALIDATION_RULES.totalCBM.messageRequired;
    } else if (data.totalCBM < 0) {
      errors.totalCBM = FORM_VALIDATION_RULES.totalCBM.messageMin;
    }

    // Weight (required, non-negative)
    if (data.weight === null || data.weight === undefined) {
      errors.weight = FORM_VALIDATION_RULES.weight.messageRequired;
    } else if (data.weight < 0) {
      errors.weight = FORM_VALIDATION_RULES.weight.messageMin;
    }

    // Fee (required, non-negative)
    if (data.fee === null || data.fee === undefined) {
      errors.fee = FORM_VALIDATION_RULES.fee.messageRequired;
    } else if (data.fee < 0) {
      errors.fee = FORM_VALIDATION_RULES.fee.messageMin;
    }

    // Date Created (required)
    if (!data.dateCreated) {
      errors.dateCreated = FORM_VALIDATION_RULES.dateCreated.message;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // ==========================================================================
  // DATE CALCULATIONS
  // ==========================================================================

  /**
   * Calculate duration between two dates in days
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Duration in days as string (empty if either date is null)
   */
  static calculateDuration(
    startDate: Date | null,
    endDate: Date | null
  ): string {
    if (!startDate || !endDate) return '';

    try {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays.toString();
    } catch (error) {
      console.error('Error calculating duration:', error);
      return '';
    }
  }

  /**
   * Calculate duration from date strings
   *
   * Used for CSV import where dates are strings.
   *
   * @param dateCreatedStr - Date created as string
   * @param dateDeliveredStr - Date delivered as string
   * @returns Duration in days as string
   */
  static calculateDurationFromStrings(
    dateCreatedStr: string,
    dateDeliveredStr: string
  ): string {
    if (!dateCreatedStr || !dateDeliveredStr) return '';

    try {
      const dateCreated = new Date(dateCreatedStr);
      const dateDelivered = new Date(dateDeliveredStr);

      // Check if dates are valid
      if (isNaN(dateCreated.getTime()) || isNaN(dateDelivered.getTime())) {
        return '';
      }

      return this.calculateDuration(dateCreated, dateDelivered);
    } catch (error) {
      console.error('Error parsing dates:', error);
      return '';
    }
  }

  /**
   * Format date for display
   *
   * @param date - Date object
   * @returns Formatted string: "MMM d, yyyy" (e.g., "Jan 15, 2024")
   */
  static formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ==========================================================================
  // DATA PARSING
  // ==========================================================================

  /**
   * Parse fee value (remove ₱ symbol and commas)
   *
   * @param fee - Fee as string or number
   * @returns Parsed fee as number
   */
  static parseFee(fee: string | number): number {
    if (typeof fee === 'number') return fee;

    const cleanedFee = fee.toString().replace(/[₱,]/g, '');
    return parseFloat(cleanedFee) || 0;
  }

  /**
   * Parse a CSV line handling quoted fields
   *
   * @param line - CSV line to parse
   * @returns Array of field values
   */
  static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
        // Don't add the quote character itself
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Calculate statistics from shipments data
   *
   * @param shipments - Array of shipment data (typically filtered data)
   * @returns Calculated statistics
   */
  static calculateStatistics(shipments: ShipmentData[]): ShipmentStatistics {
    // Status counts
    const inTransitShipments = shipments.filter(
      (s) => s['Shipment Status']?.toLowerCase() === 'in transit'
    ).length;

    const deliveredShipments = shipments.filter(
      (s) => s['Shipment Status']?.toLowerCase() === 'delivered'
    ).length;

    const manilaPortShipments = shipments.filter(
      (s) => s['Shipment Status']?.toLowerCase() === 'manila port'
    ).length;

    const withPierGatepassShipments = shipments.filter(
      (s) => s['Shipment Status']?.toLowerCase() === 'with pier gatepass'
    ).length;

    const phWarehouseShipments = shipments.filter(
      (s) => s['Shipment Status']?.toLowerCase() === 'ph warehouse'
    ).length;

    const forPickupShipments = shipments.filter(
      (s) => s['Shipment Status']?.toLowerCase() === 'for pickup'
    ).length;

    // Aggregate metrics
    const totalFees = shipments.reduce((sum, s) => {
      return sum + this.parseFee(s['Fee'] || 0);
    }, 0);

    const totalSacks = shipments.reduce((sum, s) => {
      const sacksNumber = parseFloat(s['No. Of Sacks']?.toString() || '0') || 0;
      return sum + sacksNumber;
    }, 0);

    const totalCBM = shipments.reduce((sum, s) => {
      const cbmNumber = parseFloat(s['Total CBM']?.toString() || '0') || 0;
      return sum + cbmNumber;
    }, 0);

    const totalWeight = shipments.reduce((sum, s) => {
      const weightNumber = parseFloat(s['Weight']?.toString() || '0') || 0;
      return sum + weightNumber;
    }, 0);

    return {
      totalShipments: shipments.length,
      totalFees,
      totalSacks,
      totalCBM,
      totalWeight,
      inTransitShipments,
      manilaPortShipments,
      withPierGatepassShipments,
      phWarehouseShipments,
      forPickupShipments,
      deliveredShipments,
    };
  }

  // ==========================================================================
  // API OPERATIONS
  // ==========================================================================

  /**
   * Load shipments from API
   *
   * @returns Array of shipment data
   * @throws Error if fetch fails
   */
  static async loadShipments(): Promise<ShipmentData[]> {
    const response = await fetch('/api/shipments', {
      next: { revalidate: API_REVALIDATION_SECONDS },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch shipments');
    }

    return response.json();
  }

  /**
   * Add new shipment
   *
   * @param formData - Form data to create shipment from
   * @returns Created shipment data
   * @throws Error if creation fails
   */
  static async addShipment(formData: ShipmentFormData): Promise<ShipmentData> {
    // Create shipment object from form data
    const newShipment: ShipmentData = {
      id: Date.now(), // Temporary ID (will be replaced by server)
      'Shipment Code': formData.shipmentCode,
      'CV Number': formData.cvNumber,
      'No. Of Sacks': formData.noOfSacks,
      'Total CBM': formData.totalCBM,
      Weight: formData.weight,
      Fee: formData.fee,
      'Shipment Status': formData.shipmentStatus,
      'Date Created': formData.dateCreated
        ? this.formatDateForDisplay(formData.dateCreated)
        : '',
      'Date Delivered': formData.dateDelivered
        ? this.formatDateForDisplay(formData.dateDelivered)
        : '',
      Duration: this.calculateDuration(
        formData.dateCreated,
        formData.dateDelivered
      ),
      Notes: formData.notes,
    };

    // Send to API
    const response = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShipment),
    });

    if (!response.ok) {
      throw new Error('Failed to create shipment');
    }

    const createdShipment = await response.json();

    // Show success notification
    notifications.show({
      title: '✅ Success',
      message: 'Shipment added successfully!',
      color: 'green',
    });

    return createdShipment;
  }

  /**
   * Update existing shipment
   *
   * @param id - Shipment ID to update
   * @param formData - Form data with updated values
   * @param existingShipment - Existing shipment data (for merging)
   * @returns Updated shipment data
   * @throws Error if update fails
   */
  static async updateShipment(
    id: number,
    formData: ShipmentFormData,
    existingShipment: ShipmentData
  ): Promise<ShipmentData> {
    // Update shipment object
    const updatedShipment: ShipmentData = {
      ...existingShipment,
      'Shipment Code': formData.shipmentCode,
      'CV Number': formData.cvNumber,
      'No. Of Sacks': formData.noOfSacks,
      'Total CBM': formData.totalCBM,
      Weight: formData.weight,
      Fee: formData.fee,
      'Shipment Status': formData.shipmentStatus,
      'Date Created': formData.dateCreated
        ? this.formatDateForDisplay(formData.dateCreated)
        : '',
      'Date Delivered': formData.dateDelivered
        ? this.formatDateForDisplay(formData.dateDelivered)
        : '',
      Duration: this.calculateDuration(
        formData.dateCreated,
        formData.dateDelivered
      ),
      Notes: formData.notes,
    };

    // Send to API
    const response = await fetch(`/api/shipments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedShipment),
    });

    if (!response.ok) {
      throw new Error('Failed to update shipment');
    }

    const updatedShipmentFromAPI = await response.json();

    // Show success notification
    notifications.show({
      title: '✅ Success',
      message: 'Shipment updated successfully!',
      color: 'green',
    });

    return updatedShipmentFromAPI;
  }

  /**
   * Parse CSV file and import shipments
   *
   * @param file - CSV file to parse
   * @returns Array of imported shipments
   * @throws Error if parsing or import fails
   */
  static async parseCSVFile(file: File): Promise<ShipmentData[]> {
    const text = await file.text();
    // Handle both Unix (\n) and Windows (\r\n) line endings
    const lines = text.split(/\r?\n/);

    const headers = this.parseCSVLine(lines[0]);
    const importedShipments: ShipmentData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = this.parseCSVLine(line);
        const shipmentData = { id: Date.now() + i } as Record<
          string,
          string | number
        >;

        headers.forEach((header, index) => {
          if (values[index] !== undefined && values[index] !== '') {
            shipmentData[header] = values[index];
          }
        });

        // Auto-calculate duration if both dates are present
        const dateCreated = shipmentData['Date Created'] as string;
        const dateDelivered = shipmentData['Date Delivered'] as string;

        if (dateCreated && dateDelivered) {
          shipmentData['Duration'] = this.calculateDurationFromStrings(
            dateCreated,
            dateDelivered
          );
        }

        importedShipments.push(shipmentData as unknown as ShipmentData);
      }
    }

    if (importedShipments.length === 0) {
      notifications.show({
        title: '⚠️ Import Warning',
        message: 'No valid shipment data found in the CSV file',
        color: 'yellow',
        autoClose: 4000,
      });
      throw new Error('No valid data found in CSV');
    }

    return importedShipments;
  }

  /**
   * Bulk import shipments to API
   *
   * @param shipments - Array of shipments to import
   * @returns Array of created shipments
   * @throws Error if import fails
   */
  static async bulkImportShipments(
    shipments: ShipmentData[]
  ): Promise<ShipmentData[]> {
    const response = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shipments),
      cache: 'no-store', // Bypass cache for mutations
    });

    if (!response.ok) {
      throw new Error('Failed to save shipments to database');
    }

    // Show success notification
    notifications.show({
      title: '🎉 Import Successful!',
      message: `Successfully imported ${shipments.length} shipment records`,
      color: 'green',
      autoClose: 4000,
    });

    return shipments;
  }

  // ==========================================================================
  // SEARCH & FILTER
  // ==========================================================================

  /**
   * Search shipments by query
   *
   * Searches: Shipment Code, CV Number, Shipment Status, Notes
   *
   * @param shipments - Array of shipments to search
   * @param query - Search query (case-insensitive)
   * @returns Filtered shipments
   */
  static searchShipments(
    shipments: ShipmentData[],
    query: string
  ): ShipmentData[] {
    if (!query || query.trim() === '') {
      return shipments;
    }

    const lowerQuery = query.toLowerCase();

    return shipments.filter((shipment) => {
      return (
        shipment['Shipment Code']?.toLowerCase().includes(lowerQuery) ||
        shipment['CV Number']?.toLowerCase().includes(lowerQuery) ||
        shipment['Shipment Status']?.toLowerCase().includes(lowerQuery) ||
        shipment['Notes']?.toLowerCase().includes(lowerQuery)
      );
    });
  }
}
