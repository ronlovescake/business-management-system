import { BaseService } from './BaseService';

export interface LeaveRequestDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedDate: string;
  approvedBy?: string | null;
  notes?: string | null;
}

export type LeaveRequestCreateDTO = Omit<LeaveRequestDTO, 'id'>;

export class LeaveRequestService extends BaseService {
  private static endpoint = '/leave-requests';

  static async getAll(): Promise<LeaveRequestDTO[]> {
    return this.get<LeaveRequestDTO[]>(this.endpoint);
  }

  static async getById(id: string): Promise<LeaveRequestDTO> {
    return this.get<LeaveRequestDTO>(`${this.endpoint}/${id}`);
  }

  static async create(
    leaveRequest: LeaveRequestCreateDTO
  ): Promise<{ count: number; message?: string }> {
    return this.post<{ count: number; message?: string }>(
      this.endpoint,
      leaveRequest
    );
  }

  static async bulkCreate(
    leaveRequests: LeaveRequestCreateDTO[]
  ): Promise<{ count: number; message?: string }> {
    return this.post<{ count: number; message?: string }>(
      this.endpoint,
      leaveRequests
    );
  }

  static async update(
    id: string,
    data: Partial<LeaveRequestDTO>
  ): Promise<{ message: string; request?: LeaveRequestDTO }> {
    return this.patch<{ message: string; request?: LeaveRequestDTO }>(
      `${this.endpoint}`,
      {
        id,
        ...data,
      }
    );
  }

  static async bulkUpdate(
    leaveRequests: Array<Partial<LeaveRequestDTO> & { id: string }>
  ): Promise<{ count: number; message?: string }> {
    return this.put<{ count: number; message?: string }>(
      this.endpoint,
      leaveRequests
    );
  }

  static async deleteById(
    id: string
  ): Promise<{ message: string; id: string }> {
    return this.delete<{ message: string; id: string }>(
      `${this.endpoint}/${id}`
    );
  }

  static async deleteAll(): Promise<{ count: number; message?: string }> {
    return this.delete<{ count: number; message?: string }>(this.endpoint);
  }
}
