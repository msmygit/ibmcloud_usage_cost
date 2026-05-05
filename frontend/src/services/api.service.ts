/**
 * API Service
 * Axios-based HTTP client for backend API communication
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  ApiResponse,
  ApiError,
  GenerateUserSpendingRequest,
  GenerateTeamSpendingRequest,
  GenerateReportResponse,
  ExportReportRequest,
  ResourcesQueryParams,
  UsageQueryParams,
  CacheStatsResponse,
  HealthCheckResponse,
  AccountsResponse,
} from '../types/api.types';
import type { Report } from '../types/report.types';

/**
 * API configuration
 */
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * API Service class
 */
class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create(API_CONFIG);
    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add timestamp to requests
        config.headers['X-Request-Time'] = new Date().toISOString();
        
        // Add API key if available (future authentication)
        const apiKey = localStorage.getItem('ibm_cloud_api_key');
        if (apiKey) {
          config.headers['X-API-Key'] = apiKey;
        }

        return config;
      },
      (error: AxiosError<ApiResponse>) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        return response;
      },
      (error: AxiosError<ApiResponse>) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError<ApiResponse>): ApiError {
    if (error.response) {
      // Server responded with error
      const apiError = error.response.data?.error;
      if (apiError) {
        return apiError;
      }
      
      return {
        code: 'API_ERROR',
        message: error.message || 'An error occurred',
        statusCode: error.response.status,
        details: error.response.data as unknown as Record<string, unknown>,
      };
    } else if (error.request) {
      // Request made but no response
      return {
        code: 'NETWORK_ERROR',
        message: 'No response from server. Please check your connection.',
        statusCode: 0,
      };
    } else {
      // Error setting up request
      return {
        code: 'REQUEST_ERROR',
        message: error.message || 'Failed to make request',
        statusCode: 0,
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await this.client.get<ApiResponse<HealthCheckResponse>>('/health');
    return response.data.data!;
  }

  /**
   * Get list of accessible IBM Cloud accounts
   */
  async getAccounts(): Promise<AccountsResponse> {
    const response = await this.client.get<AccountsResponse>('/api/accounts');
    return response.data;
  }

  /**
   * Generate user spending report
   */
  async generateUserSpendingReport(
    request: GenerateUserSpendingRequest
  ): Promise<GenerateReportResponse> {
    const response = await this.client.post<ApiResponse<GenerateReportResponse>>(
      '/api/reports/user-spending',
      request
    );
    return response.data.data!;
  }

  /**
   * Generate team spending report
   */
  async generateTeamSpendingReport(
    request: GenerateTeamSpendingRequest
  ): Promise<GenerateReportResponse> {
    const response = await this.client.post<ApiResponse<GenerateReportResponse>>(
      '/api/reports/team-spending',
      request
    );
    return response.data.data!;
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<Report> {
    const response = await this.client.get<ApiResponse<{ report: Report }>>(
      `/api/reports/${reportId}`
    );
    return response.data.data!.report;
  }

  /**
   * Cancel report generation
   */
  async cancelReport(reportId: string): Promise<void> {
    await this.client.delete(`/api/reports/${reportId}`);
  }

  /**
   * Export report
   */
  async exportReport(
    reportId: string,
    options: ExportReportRequest
  ): Promise<Blob> {
    const response = await this.client.post(
      `/api/reports/${reportId}/export`,
      options,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  }

  /**
   * Download report export
   */
  async downloadReport(reportId: string, format: string): Promise<Blob> {
    const response = await this.client.get(
      `/api/reports/${reportId}/download`,
      {
        params: { format },
        responseType: 'blob',
      }
    );
    return response.data;
  }

  /**
   * Get resources
   */
  async getResources(params: ResourcesQueryParams): Promise<any> {
    const response = await this.client.get('/api/resources', { params });

    // Allow browser/axios cache handling for 304 responses and only fall back
    // when the payload is actually missing.
    if (response.data == null) {
      return { resources: [] };
    }

    // /api/resources returns the resource payload at the top level, not inside
    // the standard ApiResponse.data wrapper.
    return response.data;
  }

  /**
   * Get usage data
   */
  async getUsage(params: UsageQueryParams): Promise<any> {
    const response = await this.client.get('/api/usage', { params });

    // Allow browser/axios cache handling for 304 responses and only fall back
    // when the payload is actually missing.
    if (response.data == null) {
      return { resources: [] };
    }

    // /api/usage returns { usage: ... } at the top level; the dashboard expects
    // the nested usage payload directly.
    return response.data.usage ?? { resources: [] };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStatsResponse> {
    const response = await this.client.get<ApiResponse<CacheStatsResponse>>(
      '/api/cache/stats'
    );
    return response.data.data!;
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string): Promise<void> {
    await this.client.delete('/api/cache', {
      params: pattern ? { pattern } : undefined,
    });
  }

  /**
   * Warm cache
   */
  async warmCache(accountId: string): Promise<void> {
    await this.client.post('/api/cache/warm', { accountId });
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;

// Made with Bob
