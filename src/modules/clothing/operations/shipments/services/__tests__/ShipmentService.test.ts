/**
 * Shipments Module - Service Layer Tests
 *
 * Comprehensive unit tests for ShipmentService:
 * - Validation
 * - Date calculations
 * - Data parsing
 * - Statistics
 * - API operations (mocked)
 * - CSV parsing
 * - Search/filter
 *
 * @group unit
 * @group shipments
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShipmentService } from '../ShipmentService';
import type {
  ShipmentData,
  ShipmentFormData,
} from '../../types/shipment.types';
import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';

// Mock dependencies
vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('ShipmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('validateShipment', () => {
    it('should validate shipment with all required fields', () => {
      const validData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: 'Test shipment',
      };

      const result = ShipmentService.validateShipment(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return error for missing shipment code', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: '',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.shipmentCode).toBeDefined();
    });

    it('should return error for missing shipment status', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: '',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.shipmentStatus).toBeDefined();
    });

    it('should return error for negative number of sacks', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: -5,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.noOfSacks).toBeDefined();
    });

    it('should return error for negative total CBM', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: -5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.totalCBM).toBeDefined();
    });

    it('should return error for negative weight', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: -100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.weight).toBeDefined();
    });

    it('should return error for negative fee', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: -1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.fee).toBeDefined();
    });

    it('should return error for missing date created', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-123',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: null,
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.dateCreated).toBeDefined();
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const invalidData: ShipmentFormData = {
        shipmentCode: '',
        cvNumber: 'CV-123',
        noOfSacks: -5,
        totalCBM: -5.5,
        weight: -100.5,
        fee: -1000,
        shipmentStatus: '',
        dateCreated: null,
        dateDelivered: null,
        notes: '',
      };

      const result = ShipmentService.validateShipment(invalidData);

      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(1);
      expect(result.errors.shipmentCode).toBeDefined();
      expect(result.errors.shipmentStatus).toBeDefined();
      expect(result.errors.noOfSacks).toBeDefined();
      expect(result.errors.totalCBM).toBeDefined();
      expect(result.errors.weight).toBeDefined();
      expect(result.errors.fee).toBeDefined();
      expect(result.errors.dateCreated).toBeDefined();
    });
  });

  // ==========================================================================
  // DATE CALCULATION TESTS
  // ==========================================================================

  describe('calculateDuration', () => {
    it('should calculate duration between two dates', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-11');

      const duration = ShipmentService.calculateDuration(startDate, endDate);

      expect(duration).toBe('10');
    });

    it('should return empty string when start date is null', () => {
      const endDate = new Date('2024-01-11');

      const duration = ShipmentService.calculateDuration(null, endDate);

      expect(duration).toBe('');
    });

    it('should return empty string when end date is null', () => {
      const startDate = new Date('2024-01-01');

      const duration = ShipmentService.calculateDuration(startDate, null);

      expect(duration).toBe('');
    });

    it('should return empty string when both dates are null', () => {
      const duration = ShipmentService.calculateDuration(null, null);

      expect(duration).toBe('');
    });

    it('should calculate duration correctly for same day', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-01');

      const duration = ShipmentService.calculateDuration(startDate, endDate);

      expect(duration).toBe('0');
    });

    it('should handle reversed dates (end before start)', () => {
      const startDate = new Date('2024-01-11');
      const endDate = new Date('2024-01-01');

      const duration = ShipmentService.calculateDuration(startDate, endDate);

      // Should calculate absolute difference
      expect(duration).toBe('10');
    });
  });

  describe('calculateDurationFromStrings', () => {
    it('should calculate duration from date strings', () => {
      const duration = ShipmentService.calculateDurationFromStrings(
        '2024-01-01',
        '2024-01-11'
      );

      expect(duration).toBe('10');
    });

    it('should return empty string for empty start date', () => {
      const duration = ShipmentService.calculateDurationFromStrings(
        '',
        '2024-01-11'
      );

      expect(duration).toBe('');
    });

    it('should return empty string for empty end date', () => {
      const duration = ShipmentService.calculateDurationFromStrings(
        '2024-01-01',
        ''
      );

      expect(duration).toBe('');
    });

    it('should return empty string for invalid date strings', () => {
      const duration = ShipmentService.calculateDurationFromStrings(
        'invalid-date',
        '2024-01-11'
      );

      expect(duration).toBe('');
    });
  });

  describe('formatDateForDisplay', () => {
    it('should format date for display', () => {
      const date = new Date('2024-01-15');

      const formatted = ShipmentService.formatDateForDisplay(date);

      expect(formatted).toMatch(/Jan 15, 2024/);
    });
  });

  // ==========================================================================
  // DATA PARSING TESTS
  // ==========================================================================

  describe('parseFee', () => {
    it('should parse numeric fee', () => {
      const fee = ShipmentService.parseFee(1000);

      expect(fee).toBe(1000);
    });

    it('should parse fee string without currency symbol', () => {
      const fee = ShipmentService.parseFee('1000');

      expect(fee).toBe(1000);
    });

    it('should parse fee string with peso symbol', () => {
      const fee = ShipmentService.parseFee('₱1000');

      expect(fee).toBe(1000);
    });

    it('should parse fee string with commas', () => {
      const fee = ShipmentService.parseFee('1,000');

      expect(fee).toBe(1000);
    });

    it('should parse fee string with peso symbol and commas', () => {
      const fee = ShipmentService.parseFee('₱1,000.50');

      expect(fee).toBe(1000.5);
    });

    it('should return 0 for invalid fee string', () => {
      const fee = ShipmentService.parseFee('invalid');

      expect(fee).toBe(0);
    });
  });

  describe('parseCSVLine', () => {
    it('should parse simple CSV line', () => {
      const line = 'value1,value2,value3';

      const parsed = ShipmentService.parseCSVLine(line);

      expect(parsed).toEqual(['value1', 'value2', 'value3']);
    });

    it('should parse CSV line with quoted fields', () => {
      const line = 'value1,"value2, with comma",value3';

      const parsed = ShipmentService.parseCSVLine(line);

      expect(parsed).toEqual(['value1', 'value2, with comma', 'value3']);
    });

    it('should trim whitespace from fields', () => {
      const line = ' value1 , value2 , value3 ';

      const parsed = ShipmentService.parseCSVLine(line);

      expect(parsed).toEqual(['value1', 'value2', 'value3']);
    });

    it('should handle empty fields', () => {
      const line = 'value1,,value3';

      const parsed = ShipmentService.parseCSVLine(line);

      expect(parsed).toEqual(['value1', '', 'value3']);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('calculateStatistics', () => {
    const mockShipments: ShipmentData[] = [
      {
        id: 1,
        'Shipment Code': 'SHIP-001',
        'CV Number': 'CV-001',
        'No. Of Sacks': 10,
        'Total CBM': 5.5,
        Weight: 100.5,
        Fee: 1000,
        'Shipment Status': 'In Transit',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': '',
        Duration: '',
        Notes: '',
      },
      {
        id: 2,
        'Shipment Code': 'SHIP-002',
        'CV Number': 'CV-002',
        'No. Of Sacks': 20,
        'Total CBM': 10.5,
        Weight: 200.5,
        Fee: 2000,
        'Shipment Status': 'Delivered',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': 'Jan 11, 2024',
        Duration: '10',
        Notes: '',
      },
      {
        id: 3,
        'Shipment Code': 'SHIP-003',
        'CV Number': 'CV-003',
        'No. Of Sacks': 15,
        'Total CBM': 7.5,
        Weight: 150.5,
        Fee: 1500,
        'Shipment Status': 'Manila Port',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': '',
        Duration: '',
        Notes: '',
      },
    ];

    it('should calculate total shipments', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.totalShipments).toBe(3);
    });

    it('should calculate total fees', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.totalFees).toBe(4500);
    });

    it('should calculate total sacks', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.totalSacks).toBe(45);
    });

    it('should calculate total CBM', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.totalCBM).toBe(23.5);
    });

    it('should calculate total weight', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.totalWeight).toBe(451.5);
    });

    it('should count in transit shipments', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.inTransitShipments).toBe(1);
    });

    it('should count delivered shipments', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.deliveredShipments).toBe(1);
    });

    it('should count Manila Port shipments', () => {
      const stats = ShipmentService.calculateStatistics(mockShipments);

      expect(stats.manilaPortShipments).toBe(1);
    });

    it('should return zero stats for empty array', () => {
      const stats = ShipmentService.calculateStatistics([]);

      expect(stats.totalShipments).toBe(0);
      expect(stats.totalFees).toBe(0);
      expect(stats.totalSacks).toBe(0);
      expect(stats.totalCBM).toBe(0);
      expect(stats.totalWeight).toBe(0);
      expect(stats.inTransitShipments).toBe(0);
      expect(stats.deliveredShipments).toBe(0);
    });

    it('should handle shipments with missing numeric values', () => {
      const shipmentsWithMissingValues: ShipmentData[] = [
        {
          id: 1,
          'Shipment Code': 'SHIP-001',
          'CV Number': 'CV-001',
          'No. Of Sacks': undefined as unknown as number,
          'Total CBM': undefined as unknown as number,
          Weight: undefined as unknown as number,
          Fee: undefined as unknown as number,
          'Shipment Status': 'In Transit',
          'Date Created': 'Jan 1, 2024',
          'Date Delivered': '',
          Duration: '',
          Notes: '',
        },
      ];

      const stats = ShipmentService.calculateStatistics(
        shipmentsWithMissingValues
      );

      expect(stats.totalFees).toBe(0);
      expect(stats.totalSacks).toBe(0);
      expect(stats.totalCBM).toBe(0);
      expect(stats.totalWeight).toBe(0);
    });
  });

  // ==========================================================================
  // API OPERATION TESTS
  // ==========================================================================

  describe('loadShipments', () => {
    it('should load shipments from API', async () => {
      const mockShipments: ShipmentData[] = [
        {
          id: 1,
          'Shipment Code': 'SHIP-001',
          'CV Number': 'CV-001',
          'No. Of Sacks': 10,
          'Total CBM': 5.5,
          Weight: 100.5,
          Fee: 1000,
          'Shipment Status': 'In Transit',
          'Date Created': 'Jan 1, 2024',
          'Date Delivered': '',
          Duration: '',
          Notes: '',
        },
      ];

      vi.mocked(api.get).mockResolvedValue(mockShipments);

      const result = await ShipmentService.loadShipments();

      expect(api.get).toHaveBeenCalledWith('/api/shipments');
      expect(result).toEqual(mockShipments);
    });

    it('should throw error when API call fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

      await expect(ShipmentService.loadShipments()).rejects.toThrow(
        'API Error'
      );
    });
  });

  describe('addShipment', () => {
    it('should add new shipment via API', async () => {
      const formData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-001',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'In Transit',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: null,
        notes: 'Test notes',
      };

      const mockCreatedShipment: ShipmentData = {
        id: 1,
        'Shipment Code': 'SHIP-001',
        'CV Number': 'CV-001',
        'No. Of Sacks': 10,
        'Total CBM': 5.5,
        Weight: 100.5,
        Fee: 1000,
        'Shipment Status': 'In Transit',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': '',
        Duration: '',
        Notes: 'Test notes',
      };

      vi.mocked(api.post).mockResolvedValue(mockCreatedShipment);

      const result = await ShipmentService.addShipment(formData);

      expect(api.post).toHaveBeenCalledWith(
        '/api/shipments',
        expect.objectContaining({
          'Shipment Code': 'SHIP-001',
          'CV Number': 'CV-001',
          'No. Of Sacks': 10,
        })
      );
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '✅ Success',
          color: 'green',
        })
      );
      expect(result).toEqual(mockCreatedShipment);
    });

    it('should calculate duration when both dates provided', async () => {
      const formData: ShipmentFormData = {
        shipmentCode: 'SHIP-001',
        cvNumber: 'CV-001',
        noOfSacks: 10,
        totalCBM: 5.5,
        weight: 100.5,
        fee: 1000,
        shipmentStatus: 'Delivered',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: new Date('2024-01-11'),
        notes: '',
      };

      const mockCreatedShipment: ShipmentData = {
        id: 1,
        'Shipment Code': 'SHIP-001',
        'CV Number': 'CV-001',
        'No. Of Sacks': 10,
        'Total CBM': 5.5,
        Weight: 100.5,
        Fee: 1000,
        'Shipment Status': 'Delivered',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': 'Jan 11, 2024',
        Duration: '10',
        Notes: '',
      };

      vi.mocked(api.post).mockResolvedValue(mockCreatedShipment);

      const result = await ShipmentService.addShipment(formData);

      expect(api.post).toHaveBeenCalledWith(
        '/api/shipments',
        expect.objectContaining({
          Duration: '10',
        })
      );
      expect(result).toEqual(mockCreatedShipment);
    });
  });

  describe('updateShipment', () => {
    it('should update existing shipment via API', async () => {
      const existingShipment: ShipmentData = {
        id: 1,
        'Shipment Code': 'SHIP-001',
        'CV Number': 'CV-001',
        'No. Of Sacks': 10,
        'Total CBM': 5.5,
        Weight: 100.5,
        Fee: 1000,
        'Shipment Status': 'In Transit',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': '',
        Duration: '',
        Notes: '',
      };

      const formData: ShipmentFormData = {
        shipmentCode: 'SHIP-001-UPDATED',
        cvNumber: 'CV-001',
        noOfSacks: 20,
        totalCBM: 10.5,
        weight: 200.5,
        fee: 2000,
        shipmentStatus: 'Delivered',
        dateCreated: new Date('2024-01-01'),
        dateDelivered: new Date('2024-01-11'),
        notes: 'Updated notes',
      };

      const mockUpdatedShipment: ShipmentData = {
        ...existingShipment,
        'Shipment Code': 'SHIP-001-UPDATED',
        'No. Of Sacks': 20,
        'Total CBM': 10.5,
        Weight: 200.5,
        Fee: 2000,
        'Shipment Status': 'Delivered',
        'Date Delivered': 'Jan 11, 2024',
        Duration: '10',
        Notes: 'Updated notes',
      };

      vi.mocked(api.put).mockResolvedValue(mockUpdatedShipment);

      const result = await ShipmentService.updateShipment(
        1,
        formData,
        existingShipment
      );

      expect(api.put).toHaveBeenCalledWith(
        '/api/shipments/1',
        expect.objectContaining({
          'Shipment Code': 'SHIP-001-UPDATED',
          'No. Of Sacks': 20,
        })
      );
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '✅ Success',
          color: 'green',
        })
      );
      expect(result).toEqual(mockUpdatedShipment);
    });
  });

  // ==========================================================================
  // CSV PARSING TESTS
  // ==========================================================================

  describe('parseCSVFile', () => {
    it('should parse CSV file and import shipments', async () => {
      const csvContent = `Shipment Code,CV Number,No. Of Sacks,Total CBM,Weight,Fee,Shipment Status,Date Created,Date Delivered,Duration,Notes
SHIP-001,CV-001,10,5.5,100.5,1000,In Transit,2024-01-01,2024-01-11,10,Test notes`;

      const file = {
        text: vi.fn().mockResolvedValue(csvContent),
      } as unknown as File;

      const result = await ShipmentService.parseCSVFile(file);

      expect(result).toHaveLength(1);
      expect(result[0]['Shipment Code']).toBe('SHIP-001');
      expect(result[0]['CV Number']).toBe('CV-001');
      expect(result[0]['Duration']).toBe('10');
    });

    it('should handle CSV with multiple records', async () => {
      const csvContent = `Shipment Code,CV Number,No. Of Sacks,Total CBM,Weight,Fee,Shipment Status,Date Created,Date Delivered,Duration,Notes
SHIP-001,CV-001,10,5.5,100.5,1000,In Transit,2024-01-01,2024-01-11,10,Notes 1
SHIP-002,CV-002,20,10.5,200.5,2000,Delivered,2024-01-01,2024-01-15,14,Notes 2`;

      const file = {
        text: vi.fn().mockResolvedValue(csvContent),
      } as unknown as File;

      const result = await ShipmentService.parseCSVFile(file);

      expect(result).toHaveLength(2);
      expect(result[0]['Shipment Code']).toBe('SHIP-001');
      expect(result[1]['Shipment Code']).toBe('SHIP-002');
    });

    it('should auto-calculate duration for records with both dates', async () => {
      const csvContent = `Shipment Code,CV Number,No. Of Sacks,Total CBM,Weight,Fee,Shipment Status,Date Created,Date Delivered,Duration,Notes
SHIP-001,CV-001,10,5.5,100.5,1000,Delivered,2024-01-01,2024-01-11,,Test notes`;

      const file = {
        text: vi.fn().mockResolvedValue(csvContent),
      } as unknown as File;

      const result = await ShipmentService.parseCSVFile(file);

      expect(result[0]['Duration']).toBe('10');
    });

    it('should throw error for empty CSV', async () => {
      const csvContent = `Shipment Code,CV Number,No. Of Sacks,Total CBM,Weight,Fee,Shipment Status,Date Created,Date Delivered,Duration,Notes`;

      const file = {
        text: vi.fn().mockResolvedValue(csvContent),
      } as unknown as File;

      await expect(ShipmentService.parseCSVFile(file)).rejects.toThrow(
        'No valid data found in CSV'
      );
    });

    it('should skip empty lines in CSV', async () => {
      const csvContent = `Shipment Code,CV Number,No. Of Sacks,Total CBM,Weight,Fee,Shipment Status,Date Created,Date Delivered,Duration,Notes
SHIP-001,CV-001,10,5.5,100.5,1000,In Transit,2024-01-01,2024-01-11,10,Test notes

SHIP-002,CV-002,20,10.5,200.5,2000,Delivered,2024-01-01,2024-01-15,14,Notes 2`;

      const file = {
        text: vi.fn().mockResolvedValue(csvContent),
      } as unknown as File;

      const result = await ShipmentService.parseCSVFile(file);

      expect(result).toHaveLength(2);
    });
  });

  describe('bulkImportShipments', () => {
    it('should bulk import shipments via API', async () => {
      const mockShipments: ShipmentData[] = [
        {
          id: 1,
          'Shipment Code': 'SHIP-001',
          'CV Number': 'CV-001',
          'No. Of Sacks': 10,
          'Total CBM': 5.5,
          Weight: 100.5,
          Fee: 1000,
          'Shipment Status': 'In Transit',
          'Date Created': 'Jan 1, 2024',
          'Date Delivered': '',
          Duration: '',
          Notes: '',
        },
      ];

      vi.mocked(api.post).mockResolvedValue(mockShipments);

      const result = await ShipmentService.bulkImportShipments(mockShipments);

      expect(api.post).toHaveBeenCalledWith('/api/shipments', mockShipments);
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎉 Import Successful!',
          color: 'green',
        })
      );
      expect(result).toEqual(mockShipments);
    });
  });

  // ==========================================================================
  // SEARCH & FILTER TESTS
  // ==========================================================================

  describe('searchShipments', () => {
    const mockShipments: ShipmentData[] = [
      {
        id: 1,
        'Shipment Code': 'SHIP-001',
        'CV Number': 'CV-001',
        'No. Of Sacks': 10,
        'Total CBM': 5.5,
        Weight: 100.5,
        Fee: 1000,
        'Shipment Status': 'In Transit',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': '',
        Duration: '',
        Notes: 'Urgent delivery',
      },
      {
        id: 2,
        'Shipment Code': 'SHIP-002',
        'CV Number': 'CV-002',
        'No. Of Sacks': 20,
        'Total CBM': 10.5,
        Weight: 200.5,
        Fee: 2000,
        'Shipment Status': 'Delivered',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': 'Jan 11, 2024',
        Duration: '10',
        Notes: 'Standard delivery',
      },
      {
        id: 3,
        'Shipment Code': 'SHIP-003',
        'CV Number': 'CV-003',
        'No. Of Sacks': 15,
        'Total CBM': 7.5,
        Weight: 150.5,
        Fee: 1500,
        'Shipment Status': 'Manila Port',
        'Date Created': 'Jan 1, 2024',
        'Date Delivered': '',
        Duration: '',
        Notes: 'Fragile items',
      },
    ];

    it('should return all shipments for empty query', () => {
      const result = ShipmentService.searchShipments(mockShipments, '');

      expect(result).toHaveLength(3);
    });

    it('should search by shipment code', () => {
      const result = ShipmentService.searchShipments(mockShipments, 'SHIP-001');

      expect(result).toHaveLength(1);
      expect(result[0]['Shipment Code']).toBe('SHIP-001');
    });

    it('should search by CV number', () => {
      const result = ShipmentService.searchShipments(mockShipments, 'CV-002');

      expect(result).toHaveLength(1);
      expect(result[0]['CV Number']).toBe('CV-002');
    });

    it('should search by shipment status', () => {
      const result = ShipmentService.searchShipments(mockShipments, 'Transit');

      expect(result).toHaveLength(1);
      expect(result[0]['Shipment Status']).toBe('In Transit');
    });

    it('should search by notes', () => {
      const result = ShipmentService.searchShipments(mockShipments, 'urgent');

      expect(result).toHaveLength(1);
      expect(result[0].Notes).toBe('Urgent delivery');
    });

    it('should be case-insensitive', () => {
      const result = ShipmentService.searchShipments(mockShipments, 'ship-001');

      expect(result).toHaveLength(1);
      expect(result[0]['Shipment Code']).toBe('SHIP-001');
    });

    it('should return multiple matches', () => {
      const result = ShipmentService.searchShipments(mockShipments, 'delivery');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const result = ShipmentService.searchShipments(
        mockShipments,
        'nonexistent'
      );

      expect(result).toHaveLength(0);
    });
  });
});
