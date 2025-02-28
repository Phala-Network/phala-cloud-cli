import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getApiKey } from '../utils/credentials';
import { logger } from '../utils/logger';
import { CLOUD_API_URL, CLI_VERSION } from '../utils/constants';

// Helper function to safely stringify objects that might contain cyclic references
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    if (error instanceof Error && error.message.includes('cyclic')) {
      return '[Cyclic Object]';
    }
    return String(obj);
  }
}

export class ApiClient {
  private client: AxiosInstance;
  private apiKey: string | null = null;

  constructor(baseURL: string) {
    logger.debug(`Creating API client with base URL: ${baseURL}`);
    
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `tee-cloud-cli/${CLI_VERSION}`,
      },
    });

    // Add request interceptor to include API key
    this.client.interceptors.request.use(async (config) => {
      if (!this.apiKey) {
        this.apiKey = await getApiKey();
        if (!this.apiKey) {
          throw new Error('API key not found. Please set an API key first with "teecloud auth login"');
        }
        logger.debug(`API key loaded: ${this.apiKey.substring(0, 5)}...`);
      }
      
      config.headers['X-API-Key'] = this.apiKey;
      logger.debug(`Making request to: ${config.baseURL}${config.url}`);
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Received successful response from: ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          
          logger.debug(`Received error response: ${status} - ${safeStringify(data)}`);
          
          if (status === 401) {
            logger.error('Authentication failed. Please check your API key.');
          } else if (status === 403) {
            logger.error('You do not have permission to perform this action.');
          } else if (status === 404) {
            logger.error('Resource not found.');
          } else {
            logger.error(`API Error (${status}): ${data.message || safeStringify(data)}`);
          }
        } else if (error.request) {
          logger.error('No response received from the server. Please check your internet connection.');
          logger.debug(`Request details: ${safeStringify(error.request).substring(0, 200)}...`);
        } else {
          logger.error(`Error: ${error.message}`);
        }
        
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`GET request to: ${url}`);
      const response = await this.client.get<T>(url, config);
      return response.data;
    } catch (error) {
      logger.debug(`GET request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`POST request to: ${url}`);
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      logger.debug(`POST request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`PUT request to: ${url}`);
      const response = await this.client.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      logger.debug(`PUT request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`DELETE request to: ${url}`);
      const response = await this.client.delete<T>(url, config);
      return response.data;
    } catch (error) {
      logger.debug(`DELETE request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`PATCH request to: ${url}`);
      const response = await this.client.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      logger.debug(`PATCH request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// Create and export a singleton instance
logger.debug(`Initializing API client with URL: ${CLOUD_API_URL}`);
export const apiClient = new ApiClient(CLOUD_API_URL); 