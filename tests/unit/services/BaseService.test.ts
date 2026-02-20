import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseService, APIError } from '@/services/BaseService';

// Test subclass to access protected methods
class TestService extends BaseService {
  static async testGet<T>(
    endpoint: string,
    retryConfig?: Record<string, unknown>
  ): Promise<T> {
    return this.get<T>(endpoint, retryConfig);
  }

  static async testPost<T>(
    endpoint: string,
    data: unknown,
    retryConfig?: Record<string, unknown>
  ): Promise<T> {
    return this.post<T>(endpoint, data, retryConfig);
  }

  static async testPut<T>(
    endpoint: string,
    data: unknown,
    retryConfig?: Record<string, unknown>
  ): Promise<T> {
    return this.put<T>(endpoint, data, retryConfig);
  }

  static async testDelete<T>(
    endpoint: string,
    retryConfig?: Record<string, unknown>
  ): Promise<T> {
    return this.delete<T>(endpoint, retryConfig);
  }
}

describe('BaseService', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('APIError', () => {
    it('should create APIError with correct properties', () => {
      const error = new APIError(
        'Test error',
        404,
        'Not Found',
        '/api/test',
        'GET'
      );

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
      expect(error.endpoint).toBe('/api/test');
      expect(error.method).toBe('GET');
      expect(error.name).toBe('APIError');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should be instanceof Error', () => {
      const error = new APIError(
        'Test error',
        500,
        'Internal Server Error',
        '/api/test',
        'GET'
      );
      expect(error instanceof Error).toBe(true);
    });

    it('should identify client errors correctly', () => {
      const error404 = new APIError(
        'Not found',
        404,
        'Not Found',
        '/api/test',
        'GET'
      );
      const error500 = new APIError(
        'Server error',
        500,
        'Internal Server Error',
        '/api/test',
        'GET'
      );

      expect(error404.isClientError()).toBe(true);
      expect(error500.isClientError()).toBe(false);
    });

    it('should identify server errors correctly', () => {
      const error404 = new APIError(
        'Not found',
        404,
        'Not Found',
        '/api/test',
        'GET'
      );
      const error500 = new APIError(
        'Server error',
        500,
        'Internal Server Error',
        '/api/test',
        'GET'
      );

      expect(error404.isServerError()).toBe(false);
      expect(error500.isServerError()).toBe(true);
    });

    it('should identify retryable errors correctly', () => {
      const error404 = new APIError(
        'Not found',
        404,
        'Not Found',
        '/api/test',
        'GET'
      );
      const error408 = new APIError(
        'Timeout',
        408,
        'Request Timeout',
        '/api/test',
        'GET'
      );
      const error429 = new APIError(
        'Too many requests',
        429,
        'Too Many Requests',
        '/api/test',
        'GET'
      );
      const error500 = new APIError(
        'Server error',
        500,
        'Internal Server Error',
        '/api/test',
        'GET'
      );

      expect(error404.isRetryable()).toBe(false);
      expect(error408.isRetryable()).toBe(true);
      expect(error429.isRetryable()).toBe(true);
      expect(error500.isRetryable()).toBe(true);
    });

    it('should return user-friendly messages', () => {
      const error401 = new APIError(
        'Unauthorized',
        401,
        'Unauthorized',
        '/api/test',
        'GET'
      );
      const error404 = new APIError(
        'Not found',
        404,
        'Not Found',
        '/api/test',
        'GET'
      );
      const error500 = new APIError(
        'Server error',
        500,
        'Internal Server Error',
        '/api/test',
        'GET'
      );

      expect(error401.getUserMessage()).toContain('Authentication required');
      expect(error404.getUserMessage()).toContain('not found');
      expect(error500.getUserMessage()).toContain('Server error');
    });

    it('should convert to JSON correctly', () => {
      const error = new APIError(
        'Test error',
        404,
        'Not Found',
        '/api/test',
        'GET'
      );
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'APIError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('status', 404);
      expect(json).toHaveProperty('statusText', 'Not Found');
      expect(json).toHaveProperty('endpoint', '/api/test');
      expect(json).toHaveProperty('method', 'GET');
      expect(json).toHaveProperty('timestamp');
    });
  });

  describe('GET method', () => {
    it('should make successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers: new Headers(),
      } as Response);

      const result = await TestService.testGet('/test');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should throw APIError on 404', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' }),
        headers: new Headers(),
      } as Response);

      await expect(TestService.testGet('/nonexistent')).rejects.toThrow(
        APIError
      );
    });

    it('should retry on 5xx errors', async () => {
      let callCount = 0;
      fetchSpy.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({}),
            headers: new Headers(),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ success: true }),
          headers: new Headers(),
        } as Response;
      });

      const result = await TestService.testGet('/retry-test', {
        maxRetries: 3,
      });

      expect(callCount).toBe(3);
      expect(result).toEqual({ success: true });
    });

    it('should not retry on 4xx errors (except 408, 429)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid data' }),
        headers: new Headers(),
      } as Response);

      await expect(TestService.testGet('/bad-request')).rejects.toThrow(
        APIError
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should retry on 408 timeout', async () => {
      let callCount = 0;
      fetchSpy.mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return {
            ok: false,
            status: 408,
            statusText: 'Request Timeout',
            json: async () => ({}),
            headers: new Headers(),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ success: true }),
          headers: new Headers(),
        } as Response;
      });

      await TestService.testGet('/timeout-test', { maxRetries: 2 });
      expect(callCount).toBe(2);
    });
  });

  describe('POST method', () => {
    it('should make successful POST request with data', async () => {
      const postData = { name: 'New Item', value: 123 };
      const responseData = { id: 1, ...postData };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => responseData,
        headers: new Headers(),
      } as Response);

      const result = await TestService.testPost('/items', postData);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/items',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(postData),
        })
      );
      expect(result).toEqual(responseData);
    });
  });

  describe('PUT method', () => {
    it('should make successful PUT request', async () => {
      const updateData = { name: 'Updated Item' };
      const responseData = { id: 1, ...updateData };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => responseData,
        headers: new Headers(),
      } as Response);

      const result = await TestService.testPut('/items/1', updateData);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/items/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      );
      expect(result).toEqual(responseData);
    });
  });

  describe('DELETE method', () => {
    it('should make successful DELETE request', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
        headers: new Headers(),
      } as Response);

      const result = await TestService.testDelete('/items/1');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/items/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('Retry logic', () => {
    it('should throw after max retries exceeded', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
        headers: new Headers(),
      } as Response);

      await expect(
        TestService.testGet('/always-fails', { maxRetries: 2 })
      ).rejects.toThrow(APIError);

      expect(fetchSpy).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should retry on network errors', async () => {
      let callCount = 0;
      fetchSpy.mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: async () => ({ success: true }),
          headers: new Headers(),
        } as Response;
      });

      const result = await TestService.testGet('/network-test', {
        maxRetries: 2,
      });
      expect(callCount).toBe(2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Error handling', () => {
    it('should handle network errors after max retries', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(
        TestService.testGet('/test', { maxRetries: 1 })
      ).rejects.toThrow('Network error');
    });

    it('should handle JSON parse errors', async () => {
      const malformedResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        url: '',
        redirected: false,
        type: 'basic',
        headers: new Headers(),
        body: null,
        bodyUsed: false,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        text: vi.fn(),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response;

      fetchSpy.mockResolvedValueOnce(malformedResponse);

      await expect(
        TestService.testGet('/test', { maxRetries: 0 })
      ).rejects.toThrow('Invalid JSON');
    });
  });
});
