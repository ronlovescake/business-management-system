/**
 * Comprehensive Tests for Thirteenth Month Pay Service
 * Tests CRUD operations, filtering, status updates, statistics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { thirteenthMonthPayService } from '@/modules/clothing/employees/thirteenth-month-pay/api/service';
import { thirteenthMonthPayRepository } from '@/modules/clothing/employees/thirteenth-month-pay/api/repository';
import type { ThirteenthMonthPayRecord } from '@prisma/client';
import type { ThirteenthMonthPayCreateInput } from '@/modules/clothing/employees/thirteenth-month-pay/api/schemas';

// Mock the repository
vi.mock('@/modules/clothing/employees/thirteenth-month-pay/api/repository');

describe('ThirteenthMonthPayService', () => {
  const mockRecord: ThirteenthMonthPayRecord = {
    id: '1',
    recordId: 'TMP-2025-001',
    employeeId: 'EMP001',
    employeeName: 'John Doe',
    year: 2025,
    totalBasicSalary: new Prisma.Decimal(180000),
    totalLwop: new Prisma.Decimal(0),
    totalAbsencesLates: new Prisma.Decimal(0),
    netBasicSalary: new Prisma.Decimal(180000),
    monthsWorked: 12,
    thirteenthMonthPay: new Prisma.Decimal(15000),
    status: 'pending',
    calculatedDate: '2025-01-01',
    approvedDate: null,
    paidDate: null,
    notes: null,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    it('should find all records', async () => {
      vi.mocked(thirteenthMonthPayRepository.findMany).mockResolvedValue([mockRecord]);
      
      const result = await thirteenthMonthPayService.findAll();
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRecord);
      expect(thirteenthMonthPayRepository.findMany).toHaveBeenCalledWith({
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      });
    });

    it('should handle empty results', async () => {
      vi.mocked(thirteenthMonthPayRepository.findMany).mockResolvedValue([]);
      
      const result = await thirteenthMonthPayService.findAll();
      
      expect(result).toHaveLength(0);
    });

    it('should find record by ID', async () => {
      vi.mocked(thirteenthMonthPayRepository.findById).mockResolvedValue(mockRecord);
      
      const result = await thirteenthMonthPayService.findById('1');
      
      expect(result).toEqual(mockRecord);
      expect(thirteenthMonthPayRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should return null for non-existent ID', async () => {
      vi.mocked(thirteenthMonthPayRepository.findById).mockResolvedValue(null);
      
      const result = await thirteenthMonthPayService.findById('999');
      
      expect(result).toBeNull();
    });

    it('should find record by recordId', async () => {
      vi.mocked(thirteenthMonthPayRepository.findByRecordId).mockResolvedValue(mockRecord);
      
      const result = await thirteenthMonthPayService.findByRecordId('TMP-2025-001');
      
      expect(result).toEqual(mockRecord);
      expect(thirteenthMonthPayRepository.findByRecordId).toHaveBeenCalledWith('TMP-2025-001');
    });

    it('should create a new record', async () => {
      const createData: ThirteenthMonthPayCreateInput = {
        recordId: 'TMP-2025-002',
        employeeId: 'EMP002',
        employeeName: 'Jane Smith',
        year: 2025,
        totalBasicSalary: 240000,
        totalLwop: 0,
        totalAbsencesLates: 0,
        netBasicSalary: 240000,
        monthsWorked: 12,
        thirteenthMonthPay: 20000,
        status: 'pending',
      };

      const mockCreatedRecord: ThirteenthMonthPayRecord = {
        ...mockRecord,
        id: '2',
        recordId: createData.recordId,
        employeeId: createData.employeeId ?? null,
        employeeName: createData.employeeName,
        year: createData.year,
        totalBasicSalary: new Prisma.Decimal(createData.totalBasicSalary),
        totalLwop: new Prisma.Decimal(createData.totalLwop),
        totalAbsencesLates: new Prisma.Decimal(createData.totalAbsencesLates),
        netBasicSalary: new Prisma.Decimal(createData.netBasicSalary),
        monthsWorked: createData.monthsWorked,
        thirteenthMonthPay: new Prisma.Decimal(createData.thirteenthMonthPay),
        status: createData.status,
      };

      vi.mocked(thirteenthMonthPayRepository.create).mockResolvedValue(mockCreatedRecord);
      
      const result = await thirteenthMonthPayService.create(createData);
      
      expect(result.employeeName).toBe('Jane Smith');
      expect(result.thirteenthMonthPay.toString()).toBe('20000');
      expect(thirteenthMonthPayRepository.create).toHaveBeenCalledWith(createData);
    });

    it('should create multiple records', async () => {
      const createData: ThirteenthMonthPayCreateInput[] = [
        {
          recordId: 'TMP-2025-003',
          employeeId: 'EMP003',
          employeeName: 'Bob Johnson',
          year: 2025,
          totalBasicSalary: 216000,
          totalLwop: 0,
          totalAbsencesLates: 0,
          netBasicSalary: 216000,
          monthsWorked: 12,
          thirteenthMonthPay: 18000,
          status: 'pending',
        },
        {
          recordId: 'TMP-2025-004',
          employeeId: 'EMP004',
          employeeName: 'Alice Brown',
          year: 2025,
          totalBasicSalary: 264000,
          totalLwop: 0,
          totalAbsencesLates: 0,
          netBasicSalary: 264000,
          monthsWorked: 12,
          thirteenthMonthPay: 22000,
          status: 'pending',
        },
      ];

      vi.mocked(thirteenthMonthPayRepository.createMany).mockResolvedValue({ count: 2 });
      
      const result = await thirteenthMonthPayService.createMany(createData);
      
      expect(result.count).toBe(2);
      expect(thirteenthMonthPayRepository.createMany).toHaveBeenCalledWith(createData);
    });

    it('should update a record', async () => {
      const updateData = { thirteenthMonthPay: 16000, notes: 'Adjusted amount' };
      
      vi.mocked(thirteenthMonthPayRepository.findById).mockResolvedValue(mockRecord);
      vi.mocked(thirteenthMonthPayRepository.update).mockResolvedValue({
        ...mockRecord,
        thirteenthMonthPay: new Prisma.Decimal(updateData.thirteenthMonthPay),
        notes: updateData.notes,
      });
      
      const result = await thirteenthMonthPayService.update('1', updateData);
      
      expect(result.thirteenthMonthPay.toString()).toBe('16000');
      expect(result.notes).toBe('Adjusted amount');
      expect(thirteenthMonthPayRepository.update).toHaveBeenCalledWith('1', updateData);
    });

    it('should throw error when updating non-existent record', async () => {
      vi.mocked(thirteenthMonthPayRepository.findById).mockResolvedValue(null);
      
      await expect(
        thirteenthMonthPayService.update('999', { thirteenthMonthPay: 16000 })
      ).rejects.toThrow('Record with ID 999 not found');
    });

    it('should delete a record', async () => {
      vi.mocked(thirteenthMonthPayRepository.delete).mockResolvedValue(mockRecord);
      
      await thirteenthMonthPayService.delete('1');
      
      expect(thirteenthMonthPayRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should delete all records', async () => {
      const records = [mockRecord, { ...mockRecord, id: '2' }];
      vi.mocked(thirteenthMonthPayRepository.findMany).mockResolvedValue(records);
      vi.mocked(thirteenthMonthPayRepository.delete).mockResolvedValue(mockRecord);
      
      const result = await thirteenthMonthPayService.deleteAll();
      
      expect(result.count).toBe(2);
      expect(thirteenthMonthPayRepository.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('Filtering', () => {
    it('should find records by employee ID', async () => {
      vi.mocked(thirteenthMonthPayRepository.findByEmployeeId).mockResolvedValue([mockRecord]);
      
      const result = await thirteenthMonthPayService.findByEmployeeId('EMP001');
      
      expect(result).toHaveLength(1);
      expect(result[0].employeeId).toBe('EMP001');
      expect(thirteenthMonthPayRepository.findByEmployeeId).toHaveBeenCalledWith('EMP001');
    });

    it('should find records by year', async () => {
      vi.mocked(thirteenthMonthPayRepository.findByYear).mockResolvedValue([mockRecord]);
      
      const result = await thirteenthMonthPayService.findByYear(2025);
      
      expect(result).toHaveLength(1);
      expect(result[0].year).toBe(2025);
      expect(thirteenthMonthPayRepository.findByYear).toHaveBeenCalledWith(2025);
    });

    it('should find records by status', async () => {
      vi.mocked(thirteenthMonthPayRepository.findByStatus).mockResolvedValue([mockRecord]);
      
      const result = await thirteenthMonthPayService.findByStatus('pending');
      
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
      expect(thirteenthMonthPayRepository.findByStatus).toHaveBeenCalledWith('pending');
    });

    it('should find with filters', async () => {
      const filters = { year: 2025, status: 'pending' as const };
      vi.mocked(thirteenthMonthPayRepository.findWithFilters).mockResolvedValue([mockRecord]);
      
      const result = await thirteenthMonthPayService.findWithFilters(filters);
      
      expect(result).toHaveLength(1);
      expect(thirteenthMonthPayRepository.findWithFilters).toHaveBeenCalledWith(filters);
    });
  });

  describe('Status Updates', () => {
    it('should update status to approved and set approved date', async () => {
      const recordWithoutApprovedDate = { ...mockRecord, approvedDate: null };
      
      vi.mocked(thirteenthMonthPayRepository.findByRecordId).mockResolvedValue(recordWithoutApprovedDate);
      vi.mocked(thirteenthMonthPayRepository.update).mockResolvedValue({
        ...recordWithoutApprovedDate,
        status: 'approved',
        approvedDate: new Date().toISOString(),
      });
      
      const result = await thirteenthMonthPayService.updateStatusByRecordId('TMP-2025-001', 'approved');
      
      expect(result.status).toBe('approved');
      expect(result.approvedDate).not.toBeNull();
      expect(thirteenthMonthPayRepository.update).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          status: 'approved',
          approvedDate: expect.any(String),
        })
      );
    });

    it('should not override existing approved date', async () => {
      const recordWithApprovedDate = {
        ...mockRecord,
        approvedDate: '2025-01-10T00:00:00.000Z',
      };
      
      vi.mocked(thirteenthMonthPayRepository.findByRecordId).mockResolvedValue(recordWithApprovedDate);
      vi.mocked(thirteenthMonthPayRepository.update).mockResolvedValue({
        ...recordWithApprovedDate,
        status: 'approved',
      });
      
      await thirteenthMonthPayService.updateStatusByRecordId('TMP-2025-001', 'approved');
      
      expect(thirteenthMonthPayRepository.update).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          status: 'approved',
        })
      );
      expect(thirteenthMonthPayRepository.update).not.toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          approvedDate: expect.any(String),
        })
      );
    });

    it('should update status to paid and set paid date', async () => {
      const recordWithoutPaidDate = {
        ...mockRecord,
        status: 'approved',
        approvedDate: '2025-01-10T00:00:00.000Z',
        paidDate: null,
      };
      
      vi.mocked(thirteenthMonthPayRepository.findByRecordId).mockResolvedValue(recordWithoutPaidDate);
      vi.mocked(thirteenthMonthPayRepository.update).mockResolvedValue({
        ...recordWithoutPaidDate,
        status: 'paid',
        paidDate: new Date().toISOString(),
      });
      
      const result = await thirteenthMonthPayService.updateStatusByRecordId('TMP-2025-001', 'paid');
      
      expect(result.status).toBe('paid');
      expect(result.paidDate).not.toBeNull();
      expect(thirteenthMonthPayRepository.update).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          status: 'paid',
          paidDate: expect.any(String),
        })
      );
    });

    it('should throw error when updating status for non-existent record', async () => {
      vi.mocked(thirteenthMonthPayRepository.findByRecordId).mockResolvedValue(null);
      
      await expect(
        thirteenthMonthPayService.updateStatusByRecordId('TMP-2025-999', 'approved')
      ).rejects.toThrow('Record with recordId TMP-2025-999 not found');
    });
  });

  describe('Statistics', () => {
    it('should get statistics by status', async () => {
      const stats = [
        { status: 'pending', total: 50000, count: 5 },
        { status: 'approved', total: 30000, count: 3 },
        { status: 'paid', total: 20000, count: 2 },
      ];
      
      vi.mocked(thirteenthMonthPayRepository.getTotalByStatus).mockResolvedValue(stats);
      
      const result = await thirteenthMonthPayService.getStatsByStatus();
      
      expect(result).toHaveLength(3);
      expect(result[0].status).toBe('pending');
      expect(result[0].total).toBe(50000);
      expect(result[0].count).toBe(5);
      expect(thirteenthMonthPayRepository.getTotalByStatus).toHaveBeenCalled();
    });

    it('should get statistics by year', async () => {
      const stats = [
        { year: 2025, total: 100000, count: 10 },
        { year: 2024, total: 90000, count: 9 },
      ];
      
      vi.mocked(thirteenthMonthPayRepository.getTotalByYear).mockResolvedValue(stats);
      
      const result = await thirteenthMonthPayService.getStatsByYear();
      
      expect(result).toHaveLength(2);
      expect(result[0].year).toBe(2025);
      expect(result[0].total).toBe(100000);
      expect(result[0].count).toBe(10);
      expect(thirteenthMonthPayRepository.getTotalByYear).toHaveBeenCalled();
    });

    it('should handle empty statistics', async () => {
      vi.mocked(thirteenthMonthPayRepository.getTotalByStatus).mockResolvedValue([]);
      
      const result = await thirteenthMonthPayService.getStatsByStatus();
      
      expect(result).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle error when finding all records', async () => {
      vi.mocked(thirteenthMonthPayRepository.findMany).mockRejectedValue(new Error('Database error'));
      
      await expect(thirteenthMonthPayService.findAll()).rejects.toThrow('Failed to fetch records');
    });

    it('should handle error when creating record', async () => {
      vi.mocked(thirteenthMonthPayRepository.create).mockRejectedValue(new Error('Database error'));
      
      await expect(
        thirteenthMonthPayService.create({
          recordId: 'TMP-2025-001',
          employeeId: 'EMP001',
          employeeName: 'John Doe',
          year: 2025,
          totalBasicSalary: 180000,
          totalLwop: 0,
          totalAbsencesLates: 0,
          netBasicSalary: 180000,
          monthsWorked: 12,
          thirteenthMonthPay: 15000,
          status: 'pending',
        })
      ).rejects.toThrow('Failed to create record');
    });

    it('should handle error when deleting record', async () => {
      vi.mocked(thirteenthMonthPayRepository.delete).mockRejectedValue(new Error('Database error'));
      
      await expect(thirteenthMonthPayService.delete('1')).rejects.toThrow('Failed to delete record');
    });

    it('should handle error when getting statistics', async () => {
      vi.mocked(thirteenthMonthPayRepository.getTotalByStatus).mockRejectedValue(
        new Error('Database error')
      );
      
      await expect(thirteenthMonthPayService.getStatsByStatus()).rejects.toThrow(
        'Failed to fetch statistics'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle record with zero months worked', async () => {
      const zeroMonthsRecord: ThirteenthMonthPayRecord = {
        ...mockRecord,
        monthsWorked: 0,
        thirteenthMonthPay: new Prisma.Decimal(0),
      };
      
      vi.mocked(thirteenthMonthPayRepository.create).mockResolvedValue(zeroMonthsRecord);
      
      const result = await thirteenthMonthPayService.create({
        recordId: 'TMP-2025-005',
        employeeId: 'EMP005',
        employeeName: 'New Employee',
        year: 2025,
        totalBasicSalary: 180000,
        totalLwop: 0,
        totalAbsencesLates: 0,
        netBasicSalary: 180000,
        monthsWorked: 0,
        thirteenthMonthPay: 0,
        status: 'pending',
      });
      
      expect(result.monthsWorked).toBe(0);
      expect(result.thirteenthMonthPay.toString()).toBe('0');
    });

    it('should handle partial year calculations', async () => {
      const partialYearRecord: ThirteenthMonthPayRecord = {
        ...mockRecord,
        monthsWorked: 6,
        thirteenthMonthPay: new Prisma.Decimal(7500), // Half of basic salary
      };
      
      vi.mocked(thirteenthMonthPayRepository.create).mockResolvedValue(partialYearRecord);
      
      const result = await thirteenthMonthPayService.create({
        recordId: 'TMP-2025-006',
        employeeId: 'EMP006',
        employeeName: 'Mid-year Hire',
        year: 2025,
        totalBasicSalary: 90000,
        totalLwop: 0,
        totalAbsencesLates: 0,
        netBasicSalary: 90000,
        monthsWorked: 6,
        thirteenthMonthPay: 7500,
        status: 'pending',
      });
      
      expect(result.monthsWorked).toBe(6);
      expect(result.thirteenthMonthPay.toString()).toBe('7500');
    });

    it('should handle update with id in data (should be excluded)', async () => {
      const updateData = { id: '999', thirteenthMonthPay: 16000 };
      
      vi.mocked(thirteenthMonthPayRepository.findById).mockResolvedValue(mockRecord);
      vi.mocked(thirteenthMonthPayRepository.update).mockResolvedValue({
        ...mockRecord,
        thirteenthMonthPay: new Prisma.Decimal(16000),
      });
      
      await thirteenthMonthPayService.update('1', updateData);
      
      // Verify id was excluded from update
      expect(thirteenthMonthPayRepository.update).toHaveBeenCalledWith(
        '1',
        expect.not.objectContaining({ id: expect.anything() })
      );
    });
  });
});
