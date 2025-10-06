/**
 * Base Service Class
 * Provides common HTTP operations for all services
 */
export class BaseService {
  protected static baseUrl = '/api';

  protected static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const config = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status} - ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  protected static async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  protected static async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  protected static async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  protected static async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  protected static async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  protected static async deleteVoid(endpoint: string): Promise<void> {
    await this.request<void>(endpoint, { method: 'DELETE' });
  }
}

/**
 * Generic CRUD Service Interface
 */
export interface CRUDService<T, CreateT = Partial<T>, UpdateT = Partial<T>> {
  getAll(): Promise<T[]>;
  getById(id: string | number): Promise<T>;
  create(data: CreateT): Promise<T>;
  update(id: string | number, data: UpdateT): Promise<T>;
  delete(id: string | number): Promise<void>;
  bulkCreate(data: CreateT[]): Promise<{ count: number }>;
  bulkUpdate(data: T[]): Promise<{ count: number }>;
  deleteAll(): Promise<{ count: number }>;
}
