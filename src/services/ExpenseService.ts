import { BaseService } from './BaseService';

/**
 * Expense DTO Interface
 */
export interface ExpenseDTO {
  id: number;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string | null;
  receipt: string | null;
  status: string;
  employeeName: string | null;
}

/**
 * Expense Service
 * Handles all expense-related API operations
 */
export class ExpenseService extends BaseService {
  protected static endpoint = '/expenses';

  static async getAll(): Promise<ExpenseDTO[]> {
    return this.get<ExpenseDTO[]>(this.endpoint);
  }

  static async getById(id: string | number): Promise<ExpenseDTO> {
    return this.get<ExpenseDTO>(`${this.endpoint}/${id}`);
  }

  static async create(expense: Partial<ExpenseDTO>): Promise<ExpenseDTO> {
    return this.post<ExpenseDTO>(this.endpoint, [expense]);
  }

  static async update(
    id: string | number,
    expense: Partial<ExpenseDTO>
  ): Promise<ExpenseDTO> {
    return this.patch<ExpenseDTO>(`${this.endpoint}`, {
      id,
      ...expense,
    });
  }

  static async deleteById(id: string | number): Promise<void> {
    await this.deleteVoid(`${this.endpoint}/${id}`);
  }

  static async bulkCreate(
    expenses: Partial<ExpenseDTO>[]
  ): Promise<{ count: number }> {
    return this.post<{ count: number }>(this.endpoint, expenses);
  }

  static async bulkUpdate(expenses: ExpenseDTO[]): Promise<{ count: number }> {
    return this.put<{ count: number }>(this.endpoint, expenses);
  }

  static async deleteAll(): Promise<{ count: number }> {
    return this.delete<{ count: number }>(this.endpoint);
  }

  // Expense-specific methods
  static async getByCategory(category: string): Promise<ExpenseDTO[]> {
    return this.get<ExpenseDTO[]>(
      `${this.endpoint}?category=${encodeURIComponent(category)}`
    );
  }

  static async getByStatus(status: string): Promise<ExpenseDTO[]> {
    return this.get<ExpenseDTO[]>(
      `${this.endpoint}?status=${encodeURIComponent(status)}`
    );
  }

  static async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ExpenseDTO[]> {
    return this.get<ExpenseDTO[]>(
      `${this.endpoint}?startDate=${startDate}&endDate=${endDate}`
    );
  }

  static async getByEmployee(employeeName: string): Promise<ExpenseDTO[]> {
    return this.get<ExpenseDTO[]>(
      `${this.endpoint}?employee=${encodeURIComponent(employeeName)}`
    );
  }
}

export class TruckingExpenseService extends ExpenseService {
  protected static override endpoint = '/trucking/expenses';
}
