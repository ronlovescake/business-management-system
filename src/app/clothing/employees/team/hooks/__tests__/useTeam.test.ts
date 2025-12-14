/**
 * Team Module - Utility Functions Tests
 *
 * Comprehensive tests for team module utilities:
 * - Employee ID generation
 * - Date formatting
 * - Currency formatting
 * - Status colors
 * - Data transformation
 * - CSV parsing logic
 *
 * Note: React Query hooks are tested through integration tests.
 * These tests focus on pure utility functions that can be unit tested.
 *
 * @group unit
 * @group team
 */

import { describe, it, expect } from 'vitest';

// ==========================================================================
// EMPLOYEE ID GENERATION LOGIC
// ==========================================================================

describe('Employee ID Generation', () => {
  const generateNextEmployeeId = (existingIds: string[]): string => {
    const prefix = 'EMP-';
    const existingNumbers = existingIds
      .map((id) => {
        const match = id.match(/^EMP-(\d{4,})$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((value): value is number => value !== null);

    const maxNumber =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = (maxNumber + 1).toString().padStart(4, '0');

    return `${prefix}${nextNumber}`;
  };

  it('should generate EMP-0001 when no existing IDs', () => {
    const result = generateNextEmployeeId([]);
    expect(result).toBe('EMP-0001');
  });

  it('should generate next sequential ID', () => {
    const existing = ['EMP-0001', 'EMP-0002', 'EMP-0003'];
    const result = generateNextEmployeeId(existing);
    expect(result).toBe('EMP-0004');
  });

  it('should handle non-sequential IDs', () => {
    const existing = ['EMP-0001', 'EMP-0005', 'EMP-0003'];
    const result = generateNextEmployeeId(existing);
    expect(result).toBe('EMP-0006'); // Max + 1
  });

  it('should ignore invalid ID formats', () => {
    const existing = ['EMP-0001', 'INVALID', 'EMP-ABC', ''];
    const result = generateNextEmployeeId(existing);
    expect(result).toBe('EMP-0002');
  });

  it('should pad numbers with zeros', () => {
    const existing = ['EMP-0099'];
    const result = generateNextEmployeeId(existing);
    expect(result).toBe('EMP-0100');
  });

  it('should handle IDs with more than 4 digits', () => {
    const existing = ['EMP-9999', 'EMP-10000'];
    const result = generateNextEmployeeId(existing);
    expect(result).toBe('EMP-10001');
  });

  it('should handle mixed case IDs case-sensitively', () => {
    const existing = ['emp-0001', 'EMP-0002'];
    const result = generateNextEmployeeId(existing);
    expect(result).toBe('EMP-0003'); // Only EMP-0002 is valid
  });
});

// ==========================================================================
// DATE FORMATTING
// ==========================================================================

describe('Date Formatting', () => {
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  it('should format valid ISO date', () => {
    const result = formatDate('2024-01-15');
    expect(result).toMatch(/Jan 15, 2024/);
  });

  it('should handle null date', () => {
    const result = formatDate(null);
    expect(result).toBe('N/A');
  });

  it('should handle undefined date', () => {
    const result = formatDate(undefined);
    expect(result).toBe('N/A');
  });

  it('should handle invalid date string', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('Invalid Date');
  });

  it('should handle empty string', () => {
    const result = formatDate('');
    expect(result).toBe('N/A');
  });

  it('should format different date formats', () => {
    expect(formatDate('2024-12-25')).toMatch(/Dec 25, 2024/);
    expect(formatDate('2024-06-01')).toMatch(/Jun 1, 2024/);
  });
});

// ==========================================================================
// CURRENCY FORMATTING
// ==========================================================================

describe('Currency Formatting', () => {
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₱0.00';
    }
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  it('should format positive amount', () => {
    const result = formatCurrency(50000);
    expect(result).toContain('50,000');
    expect(result).toContain('₱');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    expect(result).toBe('₱0.00');
  });

  it('should format decimal amounts', () => {
    const result = formatCurrency(12345.67);
    expect(result).toContain('12,345.67');
  });

  it('should handle null', () => {
    const result = formatCurrency(null);
    expect(result).toBe('₱0.00');
  });

  it('should handle undefined', () => {
    const result = formatCurrency(undefined);
    expect(result).toBe('₱0.00');
  });

  it('should handle NaN', () => {
    const result = formatCurrency(NaN);
    expect(result).toBe('₱0.00');
  });

  it('should format large amounts', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('1,000,000');
  });

  it('should format negative amounts', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('-');
    expect(result).toContain('500');
  });
});

// ==========================================================================
// STATUS COLORS
// ==========================================================================

describe('Status Colors', () => {
  const getStatusColor = (
    status: 'active' | 'inactive' | 'on-leave' | 'resigned' | 'terminated'
  ): string => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'on-leave':
        return 'orange';
      case 'resigned':
        return 'yellow';
      case 'terminated':
        return 'gray';
      default:
        return 'gray';
    }
  };

  it('should return green for active status', () => {
    expect(getStatusColor('active')).toBe('green');
  });

  it('should return red for inactive status', () => {
    expect(getStatusColor('inactive')).toBe('red');
  });

  it('should return orange for on-leave status', () => {
    expect(getStatusColor('on-leave')).toBe('orange');
  });

  it('should return yellow for resigned status', () => {
    expect(getStatusColor('resigned')).toBe('yellow');
  });

  it('should return gray for terminated status', () => {
    expect(getStatusColor('terminated')).toBe('gray');
  });
});

// ==========================================================================
// CSV FIELD ESCAPING
// ==========================================================================

describe('CSV Field Escaping', () => {
  const escapeCSVField = (
    field: string | number | null | undefined
  ): string => {
    if (field === null || field === undefined) {
      return '';
    }
    const strField = String(field);
    if (
      strField.includes(',') ||
      strField.includes('"') ||
      strField.includes('\n')
    ) {
      return `"${strField.replace(/"/g, '""')}"`;
    }
    return strField;
  };

  it('should not escape simple strings', () => {
    expect(escapeCSVField('John Doe')).toBe('John Doe');
  });

  it('should escape fields with commas', () => {
    expect(escapeCSVField('Doe, John')).toBe('"Doe, John"');
  });

  it('should escape fields with quotes', () => {
    expect(escapeCSVField('John "Johnny" Doe')).toBe('"John ""Johnny"" Doe"');
  });

  it('should escape fields with newlines', () => {
    expect(escapeCSVField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
  });

  it('should handle null', () => {
    expect(escapeCSVField(null)).toBe('');
  });

  it('should handle undefined', () => {
    expect(escapeCSVField(undefined)).toBe('');
  });

  it('should handle numbers', () => {
    expect(escapeCSVField(12345)).toBe('12345');
  });

  it('should escape complex fields', () => {
    expect(escapeCSVField('Test, "quoted", value')).toBe(
      '"Test, ""quoted"", value"'
    );
  });
});

// ==========================================================================
// CSV FIELD PARSING
// ==========================================================================

describe('CSV Field Parsing', () => {
  const parseCSVField = (field: string): string => {
    let value = field.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
      value = value.replace(/""/g, '"');
    }
    return value;
  };

  it('should parse unquoted field', () => {
    expect(parseCSVField('John Doe')).toBe('John Doe');
  });

  it('should parse quoted field', () => {
    expect(parseCSVField('"John Doe"')).toBe('John Doe');
  });

  it('should parse field with escaped quotes', () => {
    expect(parseCSVField('"John ""Johnny"" Doe"')).toBe('John "Johnny" Doe');
  });

  it('should trim whitespace', () => {
    expect(parseCSVField('  John Doe  ')).toBe('John Doe');
  });

  it('should handle empty string', () => {
    expect(parseCSVField('')).toBe('');
  });

  it('should handle quoted empty string', () => {
    expect(parseCSVField('""')).toBe('');
  });

  it('should parse field with commas inside quotes', () => {
    expect(parseCSVField('"Doe, John"')).toBe('Doe, John');
  });

  it('should parse field with newlines inside quotes', () => {
    expect(parseCSVField('"Line 1\nLine 2"')).toBe('Line 1\nLine 2');
  });
});

// ==========================================================================
// EMPLOYEE STATISTICS CALCULATIONS
// ==========================================================================

describe('Employee Statistics', () => {
  interface Employee {
    status: 'active' | 'inactive' | 'on-leave' | 'resigned' | 'terminated';
    currentSalary: number;
  }

  const calculateStatistics = (employees: Employee[]) => {
    return {
      totalEmployees: employees.length,
      activeEmployees: employees.filter((e) => e.status === 'active').length,
      onLeaveEmployees: employees.filter((e) => e.status === 'on-leave').length,
      inactiveEmployees: employees.filter((e) => e.status === 'inactive')
        .length,
      resignedEmployees: employees.filter((e) => e.status === 'resigned')
        .length,
      terminatedEmployees: employees.filter((e) => e.status === 'terminated')
        .length,
      totalSalary: employees
        .filter((e) => e.status === 'active')
        .reduce((sum, e) => sum + e.currentSalary, 0),
    };
  };

  it('should calculate statistics for empty array', () => {
    const stats = calculateStatistics([]);
    expect(stats.totalEmployees).toBe(0);
    expect(stats.activeEmployees).toBe(0);
    expect(stats.onLeaveEmployees).toBe(0);
    expect(stats.inactiveEmployees).toBe(0);
    expect(stats.resignedEmployees).toBe(0);
    expect(stats.terminatedEmployees).toBe(0);
    expect(stats.totalSalary).toBe(0);
  });

  it('should count all employees', () => {
    const employees = [
      { status: 'active' as const, currentSalary: 50000 },
      { status: 'inactive' as const, currentSalary: 40000 },
      { status: 'on-leave' as const, currentSalary: 60000 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.totalEmployees).toBe(3);
  });

  it('should count active employees', () => {
    const employees = [
      { status: 'active' as const, currentSalary: 50000 },
      { status: 'active' as const, currentSalary: 60000 },
      { status: 'inactive' as const, currentSalary: 40000 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.activeEmployees).toBe(2);
  });

  it('should count on-leave employees', () => {
    const employees = [
      { status: 'on-leave' as const, currentSalary: 50000 },
      { status: 'active' as const, currentSalary: 60000 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.onLeaveEmployees).toBe(1);
  });

  it('should count inactive employees', () => {
    const employees = [
      { status: 'inactive' as const, currentSalary: 50000 },
      { status: 'inactive' as const, currentSalary: 60000 },
      { status: 'active' as const, currentSalary: 70000 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.inactiveEmployees).toBe(2);
  });

  it('should count resigned employees', () => {
    const employees = [
      { status: 'resigned' as const, currentSalary: 40000 },
      { status: 'resigned' as const, currentSalary: 30000 },
      { status: 'active' as const, currentSalary: 70000 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.resignedEmployees).toBe(2);
  });

  it('should count terminated employees', () => {
    const employees = [
      { status: 'terminated' as const, currentSalary: 45000 },
      { status: 'active' as const, currentSalary: 60000 },
      { status: 'terminated' as const, currentSalary: 55000 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.terminatedEmployees).toBe(2);
  });

  it('should calculate total salary for active only', () => {
    const employees = [
      { status: 'active' as const, currentSalary: 50000 },
      { status: 'active' as const, currentSalary: 60000 },
      { status: 'inactive' as const, currentSalary: 40000 }, // Should not count
      { status: 'on-leave' as const, currentSalary: 30000 }, // Should not count
    ];
    const stats = calculateStatistics(employees);
    expect(stats.totalSalary).toBe(110000); // 50000 + 60000
  });

  it('should handle zero salaries', () => {
    const employees = [
      { status: 'active' as const, currentSalary: 0 },
      { status: 'active' as const, currentSalary: 0 },
    ];
    const stats = calculateStatistics(employees);
    expect(stats.totalSalary).toBe(0);
  });
});

// ==========================================================================
// DEPARTMENT EXTRACTION
// ==========================================================================

describe('Department Extraction', () => {
  interface Employee {
    department: string;
  }

  const extractDepartments = (employees: Employee[]): string[] => {
    const departments = new Set(employees.map((e) => e.department));
    return ['all', ...Array.from(departments).sort()];
  };

  it('should extract unique departments', () => {
    const employees = [
      { department: 'Engineering' },
      { department: 'Marketing' },
      { department: 'Engineering' },
      { department: 'Sales' },
    ];
    const departments = extractDepartments(employees);
    expect(departments).toContain('all');
    expect(departments).toContain('Engineering');
    expect(departments).toContain('Marketing');
    expect(departments).toContain('Sales');
    expect(departments).toHaveLength(4); // all + 3 unique
  });

  it('should sort departments alphabetically', () => {
    const employees = [
      { department: 'Sales' },
      { department: 'Engineering' },
      { department: 'Marketing' },
    ];
    const departments = extractDepartments(employees);
    expect(departments).toEqual(['all', 'Engineering', 'Marketing', 'Sales']);
  });

  it('should handle empty array', () => {
    const departments = extractDepartments([]);
    expect(departments).toEqual(['all']);
  });

  it('should handle single department', () => {
    const employees = [
      { department: 'Engineering' },
      { department: 'Engineering' },
    ];
    const departments = extractDepartments(employees);
    expect(departments).toEqual(['all', 'Engineering']);
  });
});

// ==========================================================================
// FORM DATA TRANSFORMATION
// ==========================================================================

describe('Form Data Transformation', () => {
  const transformFormData = (formData: Record<string, string>) => {
    return {
      employeeId: formData.employeeId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName || undefined,
      name: formData.name,
      phone: formData.phone,
      contact: formData.contact,
      email: formData.email || undefined,
      department: formData.department,
      position: formData.position,
      jobTitle: formData.jobTitle,
      status: formData.status,
      hireDate: formData.hireDate,
      basicSalary: parseFloat(formData.basicSalary),
      currentSalary: parseFloat(formData.currentSalary),
      allowance: formData.allowance
        ? parseFloat(formData.allowance)
        : undefined,
      numberOfKids: formData.numberOfKids
        ? parseInt(formData.numberOfKids, 10)
        : undefined,
    };
  };

  it('should transform basic employee data', () => {
    const formData = {
      employeeId: 'EMP-0001',
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'M',
      name: 'John Doe',
      phone: '1234567890',
      contact: '1234567890',
      email: 'john@example.com',
      department: 'Engineering',
      position: 'Developer',
      jobTitle: 'Developer',
      status: 'active',
      hireDate: '2024-01-01',
      basicSalary: '50000',
      currentSalary: '50000',
      allowance: '5000',
      numberOfKids: '2',
    };
    const result = transformFormData(formData);
    expect(result.employeeId).toBe('EMP-0001');
    expect(result.firstName).toBe('John');
    expect(result.basicSalary).toBe(50000);
    expect(result.allowance).toBe(5000);
    expect(result.numberOfKids).toBe(2);
  });

  it('should handle empty optional fields', () => {
    const formData = {
      employeeId: 'EMP-0001',
      firstName: 'John',
      lastName: 'Doe',
      middleName: '',
      name: 'John Doe',
      phone: '1234567890',
      contact: '1234567890',
      email: '',
      department: 'Engineering',
      position: 'Developer',
      jobTitle: 'Developer',
      status: 'active',
      hireDate: '2024-01-01',
      basicSalary: '50000',
      currentSalary: '50000',
      allowance: '',
      numberOfKids: '',
    };
    const result = transformFormData(formData);
    expect(result.middleName).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.allowance).toBeUndefined();
    expect(result.numberOfKids).toBeUndefined();
  });

  it('should parse numeric strings correctly', () => {
    const formData = {
      employeeId: 'EMP-0001',
      firstName: 'John',
      lastName: 'Doe',
      middleName: '',
      name: 'John Doe',
      phone: '1234567890',
      contact: '1234567890',
      email: '',
      department: 'Engineering',
      position: 'Developer',
      jobTitle: 'Developer',
      status: 'active',
      hireDate: '2024-01-01',
      basicSalary: '75000.50',
      currentSalary: '75000.50',
      allowance: '7500.25',
      numberOfKids: '3',
    };
    const result = transformFormData(formData);
    expect(result.basicSalary).toBe(75000.5);
    expect(result.currentSalary).toBe(75000.5);
    expect(result.allowance).toBe(7500.25);
    expect(result.numberOfKids).toBe(3);
  });
});
