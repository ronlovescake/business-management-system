export interface Employee {
  id: string;
  employeeId: string;

  // Name Fields
  firstName: string;
  lastName: string;
  middleName?: string;
  name: string; // Full name (for backward compatibility)

  // Contact Information
  email?: string;
  phone: string;
  contact: string; // For backward compatibility

  // Work Information
  department: string;
  position: string;
  jobTitle: string; // For backward compatibility
  currentSalary: number;
  basicSalary: number; // For backward compatibility
  hireDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  employmentStatus?:
    | 'probationary'
    | 'regular'
    | 'contractual'
    | 'project-based';
  employeeType?: 'full-time' | 'part-time' | 'contractor' | 'intern';
  office?: string;
  hiringSource?: string;

  // Government IDs
  sssNumber?: string;
  philHealthNumber?: string;
  hdmfNumber?: string; // Pag-IBIG
  tinNumber?: string;

  // Personal Information
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  education?: string;
  dateOfBirth?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  numberOfKids?: number;
  drivingLicense?: string;

  // Address and Emergency
  address?: string;
  emergencyContactPerson?: string;
  emergencyContactNumber?: string;
  emergencyContact?: string; // For backward compatibility

  // Financial Information
  bankAccount?: string;
  gcashAccount?: string;
  allowance?: number;
  paymentSchedule?: 'weekly' | 'bi-weekly' | 'monthly' | 'semi-monthly';
}

export interface EmployeeFormData {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  name: string;
  email?: string;
  phone: string;
  department: string;
  position: string;
  jobTitle: string;
  currentSalary: string;
  basicSalary: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  employmentStatus?: string;
  employeeType?: string;
  office?: string;
  hiringSource?: string;
  sssNumber?: string;
  philHealthNumber?: string;
  hdmfNumber?: string;
  tinNumber?: string;
  gender?: string;
  education?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  numberOfKids?: string;
  drivingLicense?: string;
  address?: string;
  emergencyContactPerson?: string;
  emergencyContactNumber?: string;
  bankAccount?: string;
  gcashAccount?: string;
  allowance?: string;
  paymentSchedule?: string;
  contact: string;
  emergencyContact?: string;
}
