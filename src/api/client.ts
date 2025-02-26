import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getApiKey } from '../utils/credentials';
import { logger } from '../utils/logger';

export class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `tee-cloud-cli/${process.env.CLI_VERSION || '0.0.1'}`,
      },
    });

    // Add request interceptor to include API key
    this.client.interceptors.request.use(async (config) => {
      if (!this.apiKey) {
        this.apiKey = await getApiKey();
        if (!this.apiKey) {
          throw new Error('API key not found. Please set an API key first with "teecloud auth login"');
        }
      }
      
      config.headers['X-API-Key'] = this.apiKey;
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          
          if (status === 401) {
            logger.error('Authentication failed. Please check your API key.');
          } else if (status === 403) {
            logger.error('You do not have permission to perform this action.');
          } else if (status === 404) {
            logger.error('Resource not found.');
          } else {
            logger.error(`API Error (${status}): ${data.message || JSON.stringify(data)}`);
          }
        } else if (error.request) {
          logger.error('No response received from the server. Please check your internet connection.');
        } else {
          logger.error(`Error: ${error.message}`);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient(process.env.CLOUD_API_URL || 'https://api.phala.cloud'); 