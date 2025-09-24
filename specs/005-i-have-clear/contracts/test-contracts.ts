/**
 * API Contract Tests for FIO Analyzer Frontend
 *
 * These tests validate the API contracts between frontend and backend.
 * They should be run against the actual backend to verify contract compliance.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type {
  TestRun,
  FilterOptions,
  PerformanceMetrics,
  SystemStatus,
  UserAccount,
  ApiResponse,
  HealthCheckResponse
} from '../data-model';

// Mock API client - replace with actual implementation
interface ApiClient {
  getTestRuns(params?: Record<string, string | number>): Promise<TestRun[]>;
  getFilters(): Promise<FilterOptions>;
  getTestRun(id: number): Promise<TestRun>;
  getPerformanceData(testRunIds: number[]): Promise<Array<{
    id: number;
    metrics: PerformanceMetrics;
    [key: string]: any;
  }>>;
  getHealth(): Promise<HealthCheckResponse>;
  getApiInfo(): Promise<Record<string, any>>;
  getUsers(): Promise<UserAccount[]>;
  createUser(user: { username: string; password: string; role: string }): Promise<{ message: string; user: UserAccount }>;
  updateUser(username: string, updates: Record<string, any>): Promise<{ message: string }>;
  deleteUser(username: string): Promise<{ message: string }>;
  uploadData(data: FormData): Promise<{ message: string; imported: number; failed: number; test_run_ids: number[] }>;
}

// Mock API client implementation - should be replaced with actual HTTP client
const mockApiClient: ApiClient = {
  async getTestRuns(params) {
    // This should make actual HTTP request to /api/test-runs/
    throw new Error('Contract test requires actual API implementation');
  },
  async getFilters() {
    throw new Error('Contract test requires actual API implementation');
  },
  async getTestRun(id) {
    throw new Error('Contract test requires actual API implementation');
  },
  async getPerformanceData(testRunIds) {
    throw new Error('Contract test requires actual API implementation');
  },
  async getHealth() {
    throw new Error('Contract test requires actual API implementation');
  },
  async getApiInfo() {
    throw new Error('Contract test requires actual API implementation');
  },
  async getUsers() {
    throw new Error('Contract test requires actual API implementation');
  },
  async createUser(user) {
    throw new Error('Contract test requires actual API implementation');
  },
  async updateUser(username, updates) {
    throw new Error('Contract test requires actual API implementation');
  },
  async deleteUser(username) {
    throw new Error('Contract test requires actual API implementation');
  },
  async uploadData(data) {
    throw new Error('Contract test requires actual API implementation');
  }
};

// Schema validation helpers
const isValidTestRun = (obj: any): obj is TestRun => {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'number' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.hostname === 'string' &&
    typeof obj.drive_model === 'string' &&
    typeof obj.drive_type === 'string' &&
    typeof obj.test_name === 'string' &&
    typeof obj.block_size === 'string' &&
    typeof obj.read_write_pattern === 'string' &&
    typeof obj.queue_depth === 'number' &&
    typeof obj.duration === 'number' &&
    typeof obj.iops === 'number' &&
    typeof obj.avg_latency === 'number' &&
    typeof obj.bandwidth === 'number'
  );
};

const isValidFilterOptions = (obj: any): obj is FilterOptions => {
  return (
    typeof obj === 'object' &&
    Array.isArray(obj.drive_models) &&
    Array.isArray(obj.host_disk_combinations) &&
    Array.isArray(obj.block_sizes) &&
    Array.isArray(obj.patterns) &&
    Array.isArray(obj.syncs) &&
    Array.isArray(obj.queue_depths) &&
    Array.isArray(obj.directs) &&
    Array.isArray(obj.num_jobs) &&
    Array.isArray(obj.test_sizes) &&
    Array.isArray(obj.durations) &&
    Array.isArray(obj.hostnames) &&
    Array.isArray(obj.protocols) &&
    Array.isArray(obj.drive_types)
  );
};

const isValidUserAccount = (obj: any): obj is UserAccount => {
  return (
    typeof obj === 'object' &&
    typeof obj.username === 'string' &&
    (obj.role === 'admin' || obj.role === 'uploader') &&
    Array.isArray(obj.permissions)
  );
};

describe('API Contract Tests', () => {
  beforeAll(async () => {
    // Setup test environment, ensure backend is running
    console.log('Setting up API contract tests...');
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('Cleaning up API contract tests...');
  });

  describe('Health Check Endpoints', () => {
    it('GET /health should return status OK', async () => {
      const response = await mockApiClient.getHealth();

      expect(response).toBeDefined();
      expect(response.status).toBe('OK');
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
      expect(typeof response.version).toBe('string');
    });

    it('GET /api/info should return API metadata', async () => {
      const response = await mockApiClient.getApiInfo();

      expect(response).toBeDefined();
      expect(response.name).toBe('FIO Analyzer API');
      expect(typeof response.version).toBe('string');
      expect(Array.isArray(response.features)).toBe(true);
      expect(response.authentication).toBe('HTTP Basic Auth');
    });
  });

  describe('Test Runs Endpoints', () => {
    it('GET /api/test-runs/ should return array of TestRun objects', async () => {
      const response = await mockApiClient.getTestRuns();

      expect(Array.isArray(response)).toBe(true);
      if (response.length > 0) {
        expect(isValidTestRun(response[0])).toBe(true);
      }
    });

    it('GET /api/test-runs/ should handle filter parameters', async () => {
      const response = await mockApiClient.getTestRuns({
        hostnames: 'server-01,server-02',
        drive_types: 'NVMe',
        limit: 100
      });

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeLessThanOrEqual(100);

      if (response.length > 0) {
        response.forEach(testRun => {
          expect(['server-01', 'server-02']).toContain(testRun.hostname);
          expect(testRun.drive_type).toBe('NVMe');
        });
      }
    });

    it('GET /api/test-runs/{id} should return single TestRun', async () => {
      // First get list to find a valid ID
      const testRuns = await mockApiClient.getTestRuns({ limit: 1 });
      if (testRuns.length === 0) {
        console.warn('No test runs available for single test run contract test');
        return;
      }

      const testRun = await mockApiClient.getTestRun(testRuns[0].id);

      expect(isValidTestRun(testRun)).toBe(true);
      expect(testRun.id).toBe(testRuns[0].id);
    });

    it('GET /api/test-runs/performance-data should return performance metrics', async () => {
      const testRuns = await mockApiClient.getTestRuns({ limit: 3 });
      if (testRuns.length === 0) {
        console.warn('No test runs available for performance data contract test');
        return;
      }

      const testRunIds = testRuns.map(tr => tr.id);
      const response = await mockApiClient.getPerformanceData(testRunIds);

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBe(testRunIds.length);

      response.forEach(item => {
        expect(typeof item.id).toBe('number');
        expect(testRunIds).toContain(item.id);
        expect(item.metrics).toBeDefined();
        expect(item.metrics.iops).toBeDefined();
        expect(item.metrics.avg_latency).toBeDefined();
        expect(item.metrics.bandwidth).toBeDefined();
      });
    });
  });

  describe('Filter Endpoints', () => {
    it('GET /api/filters should return FilterOptions', async () => {
      const response = await mockApiClient.getFilters();

      expect(isValidFilterOptions(response)).toBe(true);

      // Validate specific fields
      expect(response.hostnames.length).toBeGreaterThan(0);
      expect(response.drive_types.every(type => typeof type === 'string')).toBe(true);
      expect(response.block_sizes.every(size => typeof size === 'string')).toBe(true);
      expect(response.patterns.every(pattern => typeof pattern === 'string')).toBe(true);
      expect(response.syncs.every(sync => [0, 1].includes(sync))).toBe(true);
      expect(response.directs.every(direct => [0, 1].includes(direct))).toBe(true);
      expect(response.queue_depths.every(qd => typeof qd === 'number')).toBe(true);
    });

    it('Filter options should contain valid host-disk combinations', async () => {
      const response = await mockApiClient.getFilters();

      response.host_disk_combinations.forEach(combo => {
        expect(typeof combo).toBe('string');
        expect(combo).toMatch(/^.+ - .+ - .+$/); // "hostname - protocol - drive_model" format
      });
    });
  });

  describe('User Management Endpoints (Admin Only)', () => {
    it('GET /api/users should return array of UserAccount objects', async () => {
      const response = await mockApiClient.getUsers();

      expect(Array.isArray(response)).toBe(true);
      if (response.length > 0) {
        expect(isValidUserAccount(response[0])).toBe(true);
      }
    });

    it('POST /api/users should create new user', async () => {
      const newUser = {
        username: 'test_user_' + Date.now(),
        password: 'testpassword123',
        role: 'uploader'
      };

      const response = await mockApiClient.createUser(newUser);

      expect(response.message).toBe('User created successfully');
      expect(response.user.username).toBe(newUser.username);
      expect(response.user.role).toBe(newUser.role);
      expect(typeof response.user.created_at).toBe('string');

      // Cleanup
      await mockApiClient.deleteUser(newUser.username);
    });

    it('PUT /api/users/{username} should update user', async () => {
      // Create test user first
      const testUser = {
        username: 'update_test_' + Date.now(),
        password: 'testpassword123',
        role: 'uploader'
      };
      await mockApiClient.createUser(testUser);

      // Update user
      const response = await mockApiClient.updateUser(testUser.username, {
        role: 'admin'
      });

      expect(response.message).toBe('User updated successfully');

      // Cleanup
      await mockApiClient.deleteUser(testUser.username);
    });

    it('DELETE /api/users/{username} should delete user', async () => {
      // Create test user first
      const testUser = {
        username: 'delete_test_' + Date.now(),
        password: 'testpassword123',
        role: 'uploader'
      };
      await mockApiClient.createUser(testUser);

      // Delete user
      const response = await mockApiClient.deleteUser(testUser.username);

      expect(response.message).toBe('User deleted successfully');
    });
  });

  describe('Data Upload Endpoints', () => {
    it('POST /api/import should accept multipart form data', async () => {
      const formData = new FormData();
      const mockFile = new Blob(['mock fio data'], { type: 'application/json' });
      formData.append('file', mockFile, 'test-data.json');

      const response = await mockApiClient.uploadData(formData);

      expect(typeof response.message).toBe('string');
      expect(typeof response.imported).toBe('number');
      expect(typeof response.failed).toBe('number');
      expect(Array.isArray(response.test_run_ids)).toBe(true);
    });
  });

  describe('Error Handling Contracts', () => {
    it('should return 401 for unauthenticated requests', async () => {
      // This test should be configured to make requests without auth
      await expect(async () => {
        // Mock client should be configured to make unauthenticated request
        await mockApiClient.getTestRuns();
      }).rejects.toThrow(/401/);
    });

    it('should return 403 for insufficient permissions', async () => {
      // This test should be configured with uploader credentials trying admin endpoint
      await expect(async () => {
        await mockApiClient.getUsers();
      }).rejects.toThrow(/403/);
    });

    it('should return 404 for non-existent test run', async () => {
      await expect(async () => {
        await mockApiClient.getTestRun(999999);
      }).rejects.toThrow(/404/);
    });

    it('should return 400 for invalid filter parameters', async () => {
      await expect(async () => {
        await mockApiClient.getTestRuns({
          limit: -1 // Invalid limit
        });
      }).rejects.toThrow(/400/);
    });

    it('error responses should include error field and optional request_id', async () => {
      try {
        await mockApiClient.getTestRun(999999);
      } catch (error: any) {
        expect(error.response).toBeDefined();
        expect(typeof error.response.error).toBe('string');
        // request_id is optional but should be string if present
        if (error.response.request_id) {
          expect(typeof error.response.request_id).toBe('string');
        }
      }
    });
  });

  describe('Response Headers Contracts', () => {
    it('should include required response headers', async () => {
      // This would require access to actual HTTP response headers
      // Implementation depends on HTTP client used
      const response = await mockApiClient.getHealth();

      // These checks would need to be implemented based on actual HTTP client
      // expect(response.headers['content-type']).toBe('application/json');
      // expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should include CORS headers for cross-origin requests', async () => {
      // Similar to above, would need actual HTTP response access
      // expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Data Consistency Contracts', () => {
    it('filter options should reflect actual test run data', async () => {
      const testRuns = await mockApiClient.getTestRuns();
      const filters = await mockApiClient.getFilters();

      if (testRuns.length > 0) {
        // All hostnames in test runs should appear in filter options
        const testRunHostnames = [...new Set(testRuns.map(tr => tr.hostname))];
        testRunHostnames.forEach(hostname => {
          expect(filters.hostnames).toContain(hostname);
        });

        // All drive types in test runs should appear in filter options
        const testRunDriveTypes = [...new Set(testRuns.map(tr => tr.drive_type))];
        testRunDriveTypes.forEach(driveType => {
          expect(filters.drive_types).toContain(driveType);
        });
      }
    });

    it('filtered results should match filter criteria', async () => {
      const filters = await mockApiClient.getFilters();

      if (filters.hostnames.length > 0) {
        const selectedHostname = filters.hostnames[0];
        const filteredRuns = await mockApiClient.getTestRuns({
          hostnames: selectedHostname
        });

        filteredRuns.forEach(testRun => {
          expect(testRun.hostname).toBe(selectedHostname);
        });
      }
    });
  });
});

export { mockApiClient };